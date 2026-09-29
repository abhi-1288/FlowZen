# Plan: Make `admin` functionality region-based

## Goal
`admin` becomes a regional role, using the exact same "region-membership" rule already
proven in the finance salary work: an admin's scope is the members whose effective
region matches theirs (main-office fallback). `Company.owner` remains the single global
super-admin. Company-level operations that have no per-region meaning stay global and
owner-managed.

## Semantics (single source of truth: `lib/company-regions.ts`)
Already implemented — no new auth concept needed:
- Actor's region = `effectiveRegionLabelOf(company, actor)`.
- Member matches region if `regionApproverClause` / `isUserInRegion` is true (own
  `regionLabel` OR staffed in that region's `addresses[]`).
- Main office additionally matches members with empty/absent `regionLabel`
  (`effectiveRegionApproverClause`).
- No `addresses[]` on the company => scope resolves to company-wide (no behaviour change).
- Empty resolved region with zero matching members => company-wide fallback (existing
  finance rule; reused).

## Non-goals / pushback (deliberately NOT made per-region)
Company-level by nature; regionalizing them would be wrong or unsafe:
- Company takedown (`status: taken-down`) and freeze/hold — one company, one state.
- Brand theme (`icon`, `primaryColor`) — product-wide appearance.
- Join codes (`adminJoinCode`, `hrJoinCode`, ...) — a code grants a role company-wide.
- `Company.owner` reassignment, `adminHead`/`hrHead` roster, `maxHrs`/`maxAdmins` caps —
  these DEFINE the regions; must be owner/global to stay trustworthy.
- `Team`/`Board`/`ATS`/recruitment, `assets`, `tickets`, `expenses`, `budgets`, `bills`,
  `invoices` — unchanged this round (the salary-advance *policy read* becomes
  region-aware in the schema step, but the approval workflow itself stays as-is).

## Phase 1 — Shared authorization (new)
`lib/admin-region-scope.ts`:
- `isCompanyOwner(company, user)`.
- `adminRegionLabel(company, actor)` -> effective region.
- `adminMemberClause(company, actor)` -> reuse `effectiveRegionApproverClause`, or `null`
  for company-wide when no region.
- `resolveAdminMemberIds(company, actor)` -> scoped ids + `regionFallback` flag (mirrors
  existing `financeMemberScope`).
- `assertAdminTargetInScope(company, actor, targetUserId)` -> 403 on cross-region.
- `canAdministerTarget(company, actor, target)` -> owner always true, else in-region.

Extend the finance helper to delegate to these where behaviour is identical, so finance
and admin cannot drift.

## Phase 2 — Schema changes (add region to per-region models)
- `models/Holiday.ts`: add `region: { type: String, default: "", index: true }`.
  `""` = global (all regions); non-empty = that region only. Compound index with `company`.
- `models/CompanyPolicy.ts`: becomes per-(company, region).
  - add `region: { type: String, default: "", trim: true }`.
  - compound unique index `{ company: 1, region: 1 }`.
  - Backfill: existing single doc -> `region: ""` (global), so nothing is lost; regional
    policies created on demand.
  - **Read rule:** resolve the SUBJECT's region (employee's `regionLabel`, main-office
    fallback), look up `(company, subjectRegion)`; if none, fall back to `(company, "")`.
    Never use the actor's region for a subject's salary math.
- `models/Company.ts`: add `region` to embedded `wfhDates[]` / `weekendDates[]` subdocs
  (`""` = global). No new top-level company fields.
- `models/User.ts`: add `index: true` to `regionLabel` (every scoped query filters on it).
- Subjects with no `User` (candidates, public offer letter) resolve to the global
  (`region: ""`) policy — candidates have no office.

## Phase 3 — Backend scoping, highest-value first (phased, verified per phase)
Each phase: server-side scope on list + every per-record write, then UI region
pass-through/labels, then tsc + targeted eslint + manual mixed-region matrix.

1. **Approvals inbox + company/team join & people flows** (highest leverage; every
   pending request funnels here). `app/api/approvals/route.ts`,
   `app/api/approvals/[id]/route.ts`, `app/api/company/join`, `quit`, `role-transfer`,
   `app/api/company/admins`, `app/api/hr/member-region`, `app/api/users` (add role auth +
   region filter), `app/api/company/departments`. Reuse
   `effectiveRegionApproverClause` so requester/approver region checks match.
2. **Members tab + data.** `app/api/hr/members`, `employee/*`, `member-role`, `fire`,
   `member-pf-esic`, `member-salary`, `documents`, `app/api/company/details`,
   `app/api/company/reports`, `app/api/profile/reports`. Cross-region
   `PATCH member-region` becomes owner-only (moving a member changes their salary region).
3. **Finance-adjacent reads made region-aware.** `app/api/finance/policy`, `salary-cycle`,
   `salary-advance` (policy read), `salary-slip`, `reports`, `leave-impact`,
   `helpers.ts` (`computeSalaryBreakdown` + holiday/weekend lookups use the SUBJECT
   region), `status-updates` policy read, `app/api/profile` policy read,
   `lib/contract-end-disconnect`.
4. **Company settings now region-aware per model.** `app/api/attendance/holidays`
   (read: global + own region; write: own region, or global if owner),
   `app/api/company/wfh` + `app/api/company/weekends` (region on write, region-filtered
   read), `app/api/finance/policy` + `app/api/hr/policy` (region selector in UI, per-region
   salary cycle), `app/api/company/hold-freeze` -> owner-only (kept global).
   `app/api/company/address`: enforce main-office + owner for `canManageRegions` and
   validate the bulk `addresses` write (cap check, `resolveManagerIds`) that currently
   lets any admin forge `admins`/`adminHead`.
5. **Security, visitors, IT, recruitment (lower value, mostly region-irrelevant).**
   `app/api/security/*`, `app/api/visitors/*`, `app/api/it/*`, `app/api/recruitment/*`,
   `app/api/documents/*`, `app/api/public/*` — add company+region guards where a subject
   region exists; leave genuinely global (public job posts) alone.

## Cross-tenant / auth bugs found in the audit (fix early, independent of region)
Correctness bugs that undermine the boundary:
- `app/api/attendance/leave/[id]` and `app/api/attendance/wfh/[id]`: `findById(id)` with NO
  company filter; any `admin` in any company can approve another company's request. Add
  company + region guard.
- `app/api/users` GET: no role auth — any member can enumerate the whole role roster.
- `app/api/finance/salary-slip/[id]`, `app/api/finance/reports`,
  `app/api/finance/leave-impact`: missing role gate.
- `app/api/profile` self-assign `regionLabel` — must not be user-writable, or a member can
  grant themselves a finance/admin region scope.
- `PATCH /api/company/address` bulk `addresses` — unvalidated (covered in Phase 4).

## UI (per phase, alongside backend)
- Admin tabs are gated client-side only (`components/profile/profile-hub.tsx:264-296`).
  Add a region indicator ("Scoped to <Region>") and a region selector only for per-region
  settings (holidays, wfh, weekends, policy, salary cycle).
- Fix the finance salary-detail IDOR: GET `/api/finance/salary/[id]` must require
  finance/admin (or `Company.owner`) for non-own records; `canAccessFinanceRecord`
  currently returns true for any non-finance role.
- Fix wizard fallback label: when `regionFallback` is true, show
  "Showing all members (no members in <Region>)" instead of "Showing members in <Region>".
- Add a region filter to the admin members list and approvals inbox.

## Verification (per phase; no test suite exists, so be explicit)
- `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0).
- Targeted eslint over touched dirs (expect 0 errors; warnings pre-existing).
- Manual mixed-region matrix per phase:
  - Admin in Region A: list shows only A; cross-region per-record read -> 403;
    cross-region write -> 403.
  - `Company.owner`: full access; takedown/freeze/theme/joinCodes/address-roster stay global.
  - Employee with empty `regionLabel` counts as main office for reads and approver matching.
  - No `addresses[]`: everything stays company-wide (no single-office regression).
  - Per-region policy: two regions with different PF/salary-cycle produce different
    salaries; a subject with no regional policy falls back to global.
  - Cross-tenant: Region A admin cannot read/approve Region B leave/WFH.

## Docs
- `app/docs/app/profile/page.tsx` admin section: document regional admin scope,
  `Company.owner` as global super-admin, and what stays company-level.
- `app/docs/README.md`, `app/docs/app/finance/page.tsx`, `app/docs/app/attendance/page.tsx`:
  describe per-region holidays/wfh/weekends/policy and region-scoped admins.

## Risks / notes
- `CompanyPolicy` is the largest change (20+ call sites, feeds salary math). Use the
  global-fallback read rule and run the salary matrix carefully.
- Do not reset the working tree — completed docs, landing, demo-login, approval-tab, and
  finance-region work must be preserved.
- `isRegionStaffed` (`lib/company-regions.ts:109`) currently has zero call sites; Phase 4
  gives it meaning by using the roster to validate `addresses` writes.

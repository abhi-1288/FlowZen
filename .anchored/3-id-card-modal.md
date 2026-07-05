# Anchored Summary: ID Card Modal Implementation

## Goal
- Implement a two-sided ID card modal with flip, real QR code, and compact layout.

## Constraints & Preferences
- ID card must have separate front and back panels, toggled via a "Front"/"Back" button
- QR code must be functional (not a placeholder pattern)
- Card must not be over-height (compact enough to fit viewport)
- Print must show both sides (front on page 1, back on page 2)
- Follow existing patterns: Next.js App Router, Tailwind CSS, TypeScript, `window.print()` with `@media print`

## Progress
### Done
- Fixed `pdf-parse` Vercel build error by patching `isDebugMode = false` via `patch-package` + `postinstall` script
- Reverted import change in `lib/resume-parser.ts` — original `import pdf from "pdf-parse"` now works with patch applied
- Installed `qrcode@^1.5.4` and `@types/qrcode@^1.5.6` for real QR generation
- Redesigned ID card modal with two sides:
  - **Front:** Company header → "EMPLOYEE ID CARD" → Photo + employee details → Issue/Valid dates → Signature + Address box
  - **Back:** Emergency Contact → Blood Group → Joining Date → QR Code (real data URL) → Footer (return info)
- Flip toggles via "Front"/"Back" button in toolbar + flip link below card
- Print shows front on page 1 (`page-break-after`) and back on page 2 (`page-break-before`)
- Fixed React hooks ordering: moved `useEffect` and `qrValue`/`uniqueId` computations before `if (!open) return null` to avoid "Hook called conditionally" ESLint error

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Used `patch-package` to patch `pdf-parse/index.js` (`isDebugMode = false`) rather than changing imports — fixes root cause and survives `npm install`
- Split ID card into explicit front/back `<div>`s with conditional visibility classes (`id-card-side` / `id-card-side-hidden`) rather than CSS 3D flip — simpler, more reliable for print
- QR code encodes `${origin}/verify/${employeeId}` via `qrcode.toDataURL()` with error handling fallback to placeholder
- All `<img>` tags remain as-is (following existing codebase pattern in modals, not worth `next/image` overhead)

## Next Steps
- Redeploy to Vercel and verify both sides print correctly

## Relevant Files
- `components/profile/profile-hub/id-card-modal.tsx`: full front/back ID card with flip, QR code, print styles — hooks ordering fixed
- `patches/pdf-parse+1.1.1.patch` (new): patches `isDebugMode = false` in `pdf-parse/index.js`
- `package.json`: added `postinstall: "patch-package"` script, `qrcode@^1.5.4` dependency, `@types/qrcode@^1.5.6` devDependency
- `node_modules/pdf-parse/index.js`: patched in-place (`isDebugMode = true` → `false`)

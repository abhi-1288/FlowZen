# Task Continuity, EOD/EOW Compaction & Team Reporting — Implementation Plan

## Existing modules reused

| Concern | Existing FlowZen module |
| --- | --- |
| Auth / session | `lib/auth.ts`, `lib/api.ts` (`requireUserId`) |
| Company / team / role | `models/Company.ts`, `models/Team.ts`, `models/User.ts` |
| Boards / tasks | `models/Board.ts`, `models/Task.ts`, `models/Column.ts`, `lib/board-access.ts`, `lib/task-permissions.ts` |
| Attendance checkout | `app/api/attendance/checkout/route.ts`, `models/Attendance.ts` |
| Notifications | `models/Notification.ts`, `lib/socket-emit.ts` |
| Email | `lib/mailer.ts` (`sendMail`), `lib/email-templates.ts` |
| Audit | `lib/audit.ts` (`recordAudit`), `models/AuditLog.ts` |
| UI design | Profile Hub shell, `neu-card` / `neu-inset` / `neu-btn` tokens |

## Architecture decisions

1. **Do not duplicate boards or tasks.** `Task` is extended into a "major Board Task"
   (owner, team, project/department, original/revised deadline, dependencies,
   instructions, status). Existing kanban behaviour is preserved.
2. **Todos are a first-class collection** (`BoardTodo`) linked to a `Task` and
   optionally to a parent/continuation todo.
3. **Carry-forward never mutates the original todo.** It writes a history entry,
   marks the original `carried_forward`, and creates a linked continuation row.
   A unique `carryForwardKey` makes the operation idempotent.
4. **EOD is generated from the official attendance checkout.** The checkout route
   saves attendance first, then schedules draft generation with `after()` so a
   compaction failure can never reverse or delay a successful checkout.
   Generation itself is idempotent (`idempotencyKey` unique index).
5. **EOW is manual and never touches attendance.** It is an additional work
   session record with its own timestamps and optional session window.
6. **Compaction snapshots are immutable-ish.** `CompactionTodo` stores the state
   at submission. Corrections create `CompactionRevision` rows instead of
   overwriting history.
7. **Delivery is separate from submission.** `CompactionDelivery` tracks in-app
   and email channels independently. Email failures leave the report saved and
   can be retried.
8. **Team consolidation keeps source links.** `TeamCompactionSource` stores every
   included/excluded employee compaction with an exclusion reason. Aggregation
   de-duplicates todos across reports while preserving per-employee ownership.
9. **Authorization is server-side only.** Compaction access resolves the current
   team owner from `Team.manager`; admin recipients are resolved from the company
   admin/owner records; board/task recipients come from task ownership.
10. **No mock integrations.** Email goes through `sendMail`; notifications go
    through `Notification` + SSE; storage reuses the existing attachment model.

## API surface

| Route | Purpose |
| --- | --- |
| `/api/boards/major-tasks` | list/create/update major tasks |
| `/api/boards/todos` | list/create/update todos + progress logs |
| `/api/boards/todos/carry-forward` | idempotent carry-forward |
| `/api/boards/todos/handover` | create handover |
| `/api/boards/handover/[id]` | accept/decline/cancel handover |
| `/api/boards/resume` | resume workspace payload |
| `/api/boards/history` | unified task journey |
| `/api/boards/overview` | manager/admin workload dashboard |
| `/api/boards/manager-overview` | manager dashboard |
| `/api/compactions` | own compactions; EOW draft creation |
| `/api/compactions/[id]` | read/update draft |
| `/api/compactions/[id]/submit` | employee confirmation + delivery |
| `/api/compactions/[id]/review` | team-owner review/correction |
| `/api/compactions/eod` | recovery / manual EOD generation |
| `/api/team-compactions` | team-owner inbox + consolidation creation |
| `/api/team-compactions/[id]` | team compaction detail/edit |
| `/api/team-compactions/[id]/submit` | deliver to admin + task owners |
| `/api/team-compactions/[id]/review` | admin/owner acknowledge/correction |

## UI surface

- `/boards` — new Boards workspace: My Boards, My Tasks, My Todos, Delegated
  Work, Task History, Manager Overview, Resume Workspace.
- `/profile/compactions` — employee EOD/EOW history and drafts.
- `/profile/team-compactions` — Team Owner inbox, dashboard, consolidation.
- `/profile/team-compactions/:id` — Team Owner report detail.
- `/profile/received-team-compactions` — Admin / Board-Task Owner inbox.

## Testing

Pure aggregation helpers (`lib/compaction.ts`) are unit-tested with
`node --test`: status rollups, de-duplication, carry-forward keys and date
normalisation. Route-level guarantees are enforced by:
- unique indexes (idempotency, carry-forward, delivery event),
- server-side ownership checks on every read/write,
- transactional/`findOneAndUpdate` state transitions for submit/accept/decline.

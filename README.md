# FlowZen

FlowZen is a full-stack team productivity platform built with Next.js App Router, Tailwind CSS, Zustand, NextAuth, MongoDB, SSE (Server-Sent Events), Socket.IO, and `@dnd-kit/core`. It combines kanban project management, attendance tracking, finance & invoicing, HR tools, and role-based access into one unified workspace.

## Key Features

- **Kanban Boards** — Real-time drag-and-drop task management with priorities, due dates, assignees, leads, comments, attachments, activity logs, and auto-expired columns.
- **Attendance Tracking** — Check-in/check-out with location logging, WFH modes (all-day / wfh-only), scheduled WFH dates, holiday management, and attendance report export.
- **Leave Management** — Multi-step approval workflow (HR → Manager), leave requests with start/end dates, reason, and type.
- **Finance Module** — Salary management per member, expense requests & bills, project budgets (allocated/spent/remaining), client invoice generation (printable PDF), resource/asset requests, yearly revenue reports, and leave impact calculations.
- **HR Management** — Member role changes, employee termination, company policy management, HR messages/broadcasts, and meeting invites.
- **Role-Based Access** — 7 user roles (Employee, Project Manager, QA Tester, Human Resource, Finance, Admin, Others) with granular board-level permissions.
- **Multi-Step Approval Workflows** — Join requests (HR → Admin), leave requests (HR → Manager), and quit requests with replacement tracking.
- **Company & Team Management** — Company registration with identity codes, team creation with invite codes, freeze/takedown company, kick/quit team, and approval-based onboarding.
- **Authentication** — Email/password with 6-digit OTP verification, magic-link password reset, and 5 social OAuth providers (Google, Azure AD / Microsoft, Apple, GitHub, Discord).
- **Real-Time Updates** — Dual system: SSE (primary, current) via EventHub and legacy Socket.IO for instant board, notification, and event streaming.
- **Notifications** — Join requests, approvals, system updates, task events, and HR messages — all with read/unread tracking.
- **Profile Center** — 9-tab hub with general settings, company/team/board management, attendance, leave, finance, admin tools, and notifications.
- **Avatar Upload** — Local filesystem uploads (max 2MB, PNG/JPG/WEBP).
- **Invoice Generation** — Printable client invoices with items, tax, and totals.

## Tech Stack

- Next.js 15 App Router
- React 19
- Tailwind CSS v3
- MongoDB + Mongoose 8
- NextAuth v4
- Zustand
- Framer Motion
- Server-Sent Events (EventHub)
- Socket.IO (legacy real-time)
- `@dnd-kit/core`
- Nodemailer

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with the values below:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/flowzen
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=replace-with-a-long-random-secret
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   AZURE_AD_CLIENT_ID=
   AZURE_AD_CLIENT_SECRET=
   AZURE_AD_TENANT_ID=common
   APPLE_CLIENT_ID=
   APPLE_CLIENT_SECRET=
   GITHUB_ID=
   GITHUB_SECRET=
   DISCORD_CLIENT_ID=
   DISCORD_CLIENT_SECRET=
   SMTP_HOST=
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM="FlowZen <no-reply@flowzen.local>"
   ```

3. Start MongoDB locally or point `MONGODB_URI` at MongoDB Atlas.

   With Docker:

   ```bash
   docker compose up -d
   ```

   Or install MongoDB Community Server and ensure it listens on `127.0.0.1:27017`.

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` and register a new account.

## Scripts

- `npm run dev` — start the development server.
- `npm run build` — build the production app.
- `npm run start` — start the production server.
- `npm run lint` — run ESLint across the project.
- `npm run typecheck` — run TypeScript type checking.

## Routes

- `/` — landing page (redirects to `/profile` if authenticated)
- `/login` — email/password login with 5 OAuth providers
- `/signup` — 2-step registration with 6-digit OTP verification
- `/join?code=` — join company or team by invitation code
- `/forgot-password` — request magic-link password reset email
- `/reset-password?token=` — set new password via magic link
- `/profile/[[...tab]]` — 9-tab profile hub (settings, company, teams, boards, attendance, leave, finance, admin, notifications)
- `/board` — board list / workspace selector
- `/board/[id]` — individual board workspace with real-time collaboration
- `/invoice/[id]` — printable client invoice PDF

## Onboarding Flow

1. An **Admin** registers a company from `/profile`, then shares the generated company identity code (`CO-XXXXX`).
2. **Users** join the company via `/join?code=CO-XXXXX`, submitting a join request.
3. **HR** reviews and approves/rejects the join request first, then an **Admin** final-approves it (multi-step approval).
4. Once approved, **Project Managers** (and others) can create teams and share team invite codes (`CO-XXXXX-TM-XXXXX`).
5. **Employees** join teams via the team code and wait for manager approval.
6. All requests, approvals, rejections, and system events generate real-time notifications.
7. **Leave requests** follow a separate multi-step chain (HR → Manager).
8. **Quit requests** require HR to identify a replacement before final approval.

## User Roles (7)

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access — manage company, teams, all boards, member roles, freeze/takedown company |
| **Human Resource** | Approve/reject join & leave requests, manage policies, fire employees, send HR messages & meeting invites |
| **Project Manager** | Create/manage teams, create/manage boards, assign tasks, manage team members |
| **Finance** | Manage salaries, expense requests & bills, client invoices, project budgets, resource requests |
| **QA Tester** | Access boards as tester role, test and verify tasks |
| **Employee** | View assigned tasks, check-in/check-out, request leave, view attendance & finance data |
| **Others** | Fallback role with basic board access |

## Project Structure

- `app/api` — 50+ API route handlers for auth, boards, columns, tasks, comments, attachments, company, team, profile, approvals, attendance, finance, HR, events, notifications, messages, and more.
- `app/board/[id]` — board workspace and task collaboration route.
- `app/profile/[[...tab]]` — 9-tab profile hub with settings, company, teams, boards, attendance, leave, finance, admin, and notifications.
- `app/invoice/[id]` — printable client invoice PDF.
- `app/join` — company/team join via invitation code.
- `components/boards` — board canvas, columns, task cards, modals, and board UI.
- `components/profile` — profile dashboard, attendance, finance, admin tools, and WFH assignment.
- `components/landing` — landing page UI.
- `store/board-store.ts` — Zustand store for boards, columns, tasks, modals, and backend sync.
- `models` — 15 Mongoose models for User, Board, Column, Task, Company, Team, JoinRequest, Notification, LeaveRequest, Attendance, Holiday, FinanceSalary, ClientInvoice, ExpenseRequest, ExpenseBill, ProjectBudget, and ResourceRequest.
- `lib` — shared database, auth, API, realtime (EventHub SSE + Socket.IO), mailer, code generators, board access, and type utilities.
- `types` — TypeScript type declarations for NextAuth, Socket.IO, and module shims.
- `pages/api/socket.ts` — legacy Socket.IO server (Pages Router) for real-time events.

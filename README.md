# FlowZen

FlowZen is a full-stack team productivity platform built with Next.js App Router, Tailwind CSS, Zustand, NextAuth, MongoDB, SSE (Server-Sent Events), Socket.IO, and `@dnd-kit/core`. It combines kanban project management, attendance tracking, finance & invoicing, HR tools, recruitment, real-time chat, and role-based access into one unified workspace.

## Key Features

- **Kanban Boards** — Real-time drag-and-drop task management with priorities, due dates, assignees, leads, comments, attachments, activity logs, and auto-expired columns.
- **Attendance Tracking** — Check-in/check-out with location logging, WFH modes (all-day / wfh-only), scheduled WFH dates, holiday management, and attendance report export.
- **Leave Management** — Multi-step approval workflow (HR → Manager), leave requests with start/end dates, reason, and type.
- **Finance Module** — Salary management per member, expense requests & bills, project budgets (allocated/spent/remaining), client invoice generation (printable PDF), resource/asset requests, yearly revenue reports, leave impact calculations, and automated monthly salary generation via payroll processing.
- **HR Management** — Member role changes, employee termination, company policy management (including food & travel accommodation amounts), HR messages/broadcasts, and meeting invites.
- **Recruitment & Hiring** — Full recruitment lifecycle: job posting, candidate applications with magic-link portal, interview scheduling & feedback (with email notifications to candidate and interviewer), structured notes (author/timestamp/deletable), auto-close overdue jobs with candidate stats notifications, pipeline conversion funnel with drop-off analytics, resume PDF parsing (DOB/address extraction), offer letter generation (with CTC, perks, food/travel allowances), candidate portal for offer acceptance/rejection, and convert-to-employee with welcome email.
- **Chat & Messaging** — Real-time messaging with read/delivery receipt ticks (single grey ✓ sent, double grey ✓✓ received, double green ✓✓ read). Online presence indicators (green dot, "Online" / "Last online" text) in chat header and member sidebar. Info modal with user personal details (name, role, email, phone, DOB, employee ID, team, join date).
- **Role-Based Access** — 7 user roles (Employee, Project Manager, QA Tester, Human Resource, Finance, Admin, Others) with granular board-level permissions. Profile hub tabs gated by company status and role.
- **Multi-Step Approval Workflows** — Join requests (HR → Admin), leave requests (HR → Manager), and quit requests with replacement tracking.
- **Company & Team Management** — Company registration with identity codes, team creation with invite codes, freeze/takedown company, kick/quit team, and approval-based onboarding.
- **Authentication** — Email/password with 6-digit OTP verification, magic-link password reset, and 5 social OAuth providers (Google, Azure AD / Microsoft, Apple, GitHub, Discord). "Remember me" session persistence control. Email change with current password verification + OTP to new email.
- **Real-Time Updates** — Dual system: SSE (primary) via EventHub and legacy Socket.IO for instant board, notification, event, and message streaming.
- **Notifications** — Join requests, approvals, system updates, task events, and HR messages — all with read/unread tracking, paginated listing (15 per page), and date-range filtering.
- **Profile Center** — Multi-tab hub with dashboard, profile, timeline, onboarding, members, careers, documents, messages, finance, approvals, attendance, and notifications — all role-gated. Edit personal info (name, phone, DOB, address) via modal with country code select and confirmation step.
- **Avatar Upload** — Local filesystem uploads (max 2MB, PNG/JPG/WEBP).
- **Invoice Generation** — Printable client invoices with items, tax, and totals.
- **Offer Letters** — Generate and preview offer letters with full CTC breakdown, perks, food & travel allowances (from company policy). Downloadable HTML and candidate-facing portal view.

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
- pdf-parse

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

5. Optional: create demo tester accounts:

   ```bash
   npm run seed:demo
   ```

6. Open `http://localhost:3000` and register a new account or use a demo account.

## Demo Tester Accounts

Run `npm run seed:demo` after setting `MONGODB_URI` to create or refresh these verified accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@flowzen.com` | `admin@flowzen` |
| Project Manager | `manager@flowzen.com` | `manager@flowzen` |
| Human Resource | `hr@flowzen.com` | `hr@flowzen` |
| QA Tester | `tester@flowzen.com` | `tester@flowzen` |
| Employee | `employee@flowzen.com` | `employee@flowzen` |
| Finance | `finance@flowzen.com` | `finance@flowzen` |
| Others | `other@flowzen.com` | `other@flowzen` |

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
- `/profile/[[...tab]]` — 13-tab profile hub (dashboard, profile, timeline, onboarding, members, careers, documents, messages, finance, approvals, attendance, notifications, admin)
- `/api/profile/email/verify` — POST: validates current password, sends OTP to new email
- `/api/profile/email/confirm` — POST: validates OTP and updates email
- `/board` — board list / workspace selector
- `/board/[id]` — individual board workspace with real-time collaboration
- `/invoice/[id]` — printable client invoice PDF
- `/recruitment/candidates` — candidate list with pipeline stages
- `/recruitment/candidates/[id]` — candidate profile with timeline, interviews, offer, stage management
- `/recruitment/candidates/[id]/offer` — offer letter preview in new tab
- `/recruitment/jobs` — job listing management
- `/recruitment/offers` — offer management dashboard
- `/recruitment/offers/[id]/letter` — HR-facing offer letter preview
- `/careers` — public careers page listing open positions
- `/careers/jobs/[companyName]/[id]` — public job detail page with apply form
- `/candidate-portal` — magic-link authenticated candidate dashboard (timeline, interviews, offer acceptance)

## Onboarding Flow

1. An **Admin** registers a company from `/profile`, then shares the generated company identity code (`CO-XXXXX`).
2. **Users** join the company via `/join?code=CO-XXXXX`, submitting a join request.
3. **HR** reviews and approves/rejects the join request first, then an **Admin** final-approves it (multi-step approval).
4. Once approved, **Project Managers** (and others) can create teams and share team invite codes (`CO-XXXXX-TM-XXXXX`).
5. **Employees** join teams via the team code and wait for manager approval.
6. All requests, approvals, rejections, and system events generate real-time notifications.
7. **Leave requests** follow a separate multi-step chain (HR → Manager).
8. **Quit requests** require HR to identify a replacement before final approval.

## Recruitment Flow

1. **HR/Admin** creates job postings from the recruitment dashboard with title, description, salary range, required skills, and employment type.
2. **Candidates** apply via the public careers page (`/careers`), receiving an email with a unique magic-link token for their portal. Candidates can also be added manually with manual stage assignment.
3. **Interviewers** (assigned by HR) view candidate details, schedule interviews (email notifications sent to both candidate and interviewer), and submit feedback with ratings.
4. **HR/Admin** can write structured notes (author/timestamp/deletable by author) on candidate profiles for internal collaboration.
5. **HR/Admin** can auto-close overdue jobs — notifies all candidates in the pipeline with their current-stage stats (total / shortlisted / interviewed / offered).
6. **Pipeline funnel** displays drop-off analytics across stages (new → screened → shortlisted → interviewed → offered → joined → rejected), helping identify bottlenecks.
7. When candidates upload resumes, **resume PDF parsing** extracts DOB and address fields automatically for the candidate profile.
8. **HR/Admin** generates offer letters with full CTC breakdown, perks, food & travel allowances, and office location — previewable before sending.
9. Once sent, **candidates** view and accept/reject offers from their portal. Accepted offers auto-advance the candidate stage to `joined`.
10. **HR** converts `joined` candidates to employees by setting a password — a welcome email with credentials is sent automatically. Resume-extracted DOB/address is copied to the new employee profile.
11. Throughout the process, the candidate portal provides a timeline of all events, interview history, and the latest offer status.

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

- `app/api` — 70+ API route handlers for auth, boards, columns, tasks, comments, attachments, company, team, profile (including `profile/email/verify` and `profile/email/confirm`), approvals, attendance, finance, HR, recruitment (jobs, candidates, interviews, offers, letters, auto-close, notes), events, notifications, messages, and more.
- `app/board/[id]` — board workspace and task collaboration route.
- `app/profile/[[...tab]]` — multi-tab profile hub with dashboard, settings, company, teams, boards, attendance, leave, finance, admin, members, documents, messages, approvals, careers, notifications, and onboarding.
- `app/invoice/[id]` — printable client invoice PDF.
- `app/join` — company/team join via invitation code.
- `app/recruitment` — full recruitment dashboard: candidate pipeline, job management, offer management, and candidate detail pages.
- `app/careers` — public career listings with job detail pages and candidate application.
- `app/candidate-portal` — magic-link authenticated candidate dashboard with timeline, interviews, and offer acceptance.
- `components/boards` — board canvas, columns, task cards, modals, and board UI.
- `components/profile` — profile hub tabs, attendance, finance, admin tools, WFH assignment, and members management.
- `components/recruitment` — recruitment-specific components: candidate cards, interview forms, offer modals, convert-to-employee.
- `components/landing` — landing page UI.
- `store/board-store.ts` — Zustand store for boards, columns, tasks, modals, and backend sync.
- `store/message-store.ts` — Zustand store for chat messages, conversations, unread counts, and typing indicators.
- `store/recruitment-store.ts` — Zustand store for recruitment state: jobs, candidates, filters, offer generation.
- `models` — 20+ Mongoose models for User, Board, Column, Task, Company, Team, JoinRequest, Notification, LeaveRequest, Attendance, Holiday, FinanceSalary, ClientInvoice, ExpenseRequest, ExpenseBill, ProjectBudget, ResourceRequest, ATSJob, ATSCandidate, ATSOffer, ATSInterview, CompanyPolicy, and Message.
- `lib` — shared database, auth, API, realtime (EventHub SSE + Socket.IO), mailer, code generators, board access, recruitment utilities (`recruitment-utils.ts`), resume parser (`resume-parser.ts`), email templates (`email-templates.ts`), and type utilities.
- `types` — TypeScript type declarations for NextAuth, Socket.IO, recruitment types, and module shims.
- `pages/api/socket.ts` — legacy Socket.IO server (Pages Router) for real-time events.

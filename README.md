# FlowZen

FlowZen is a full-stack task management app built with Next.js App Router, MongoDB/Mongoose, Tailwind CSS, Zustand, NextAuth, and `@dnd-kit/core`.

## Features

- Email/password authentication with NextAuth credentials.
- Role-based auth for employees, project managers, and admins.
- Signup with name, email, password, role, and 6-digit OTP verification sent with Nodemailer.
- Employee, project manager, and admin login with email/password after OTP verification.
- Project manager login with Google, Microsoft, Apple, GitHub, or Discord OAuth.
- Forgot-password flow that emails a temporary password.
- Profile center with password update, logout, account deletion, role timeline, onboarding codes, approvals, and notifications.
- User-scoped boards with owner/member roles.
- Board CRUD with default Todo, In Progress, and Done columns.
- Column CRUD and drag reordering.
- Task CRUD with title, description, due date, priority, status column, and persisted order.
- Task dragging within a column and across columns using `@dnd-kit/core`.
- Zustand store for boards, columns, tasks, modal state, loading, and API sync.
- Board invites, task comments, attachment URL UI, activity log, and notifications routes.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
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

   Without Docker, install MongoDB Community Server and make sure it is listening on `127.0.0.1:27017`.

   For MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string, for example:

   ```bash
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/flowzen?retryWrites=true&w=majority
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`, create an account, and start building boards.

## Role Onboarding

- Admins register a company from `/profile`, then share the generated company code or URL.
- Project managers enter the company code from `/profile`; the admin receives an approval request.
- After approval, project managers create a team and share the generated team code.
- Employees enter the team code from `/profile`; the project manager receives an approval request.
- Notifications track joins, approvals, system notices, project events, and deadline reminders.

## Project Structure

- `app/api`: Next.js route handlers for auth, boards, columns, tasks, comments, attachments, and notifications.
- `app/board/[id]`: authenticated board workspace route.
- `components/boards`: sidebar, board canvas, columns, task cards, and modals.
- `store/board-store.ts`: Zustand state and backend sync actions.
- `models`: Mongoose models for User, Board, Column, Task, and Notification.
- `lib`: database, auth, API helpers, access checks, and shared types.

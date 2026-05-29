# FlowZen

FlowZen is a full-stack team productivity platform built with Next.js App Router, Tailwind CSS, Zustand, NextAuth, MongoDB, Socket.IO, and `@dnd-kit/core`.

## Key Features

- Real-time kanban boards with drag-and-drop task management.
- Role-based access, approval workflows, and team onboarding.
- Email/password authentication with 6-digit OTP verification.
- Social OAuth login for Google, Microsoft, Apple, GitHub, and Discord.
- Notifications, approvals, team invites, project events, and task activity.
- Profile center with password updates, account deletion, and onboarding codes.



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

- `/` — landing page
- `/login` — login flow
- `/signup` — signup and OTP verification
- `/profile` — user profile and company onboarding
- `/board/[id]` — authenticated board workspace

## Role Onboarding

- Admins register a company from `/profile`, then share the generated company code or URL.
- Project managers request access using the company code; admins approve join requests.
- After approval, project managers create teams and share team join codes.
- Employees join via team code and wait for manager approval.
- Notifications track join requests, approvals, system updates, and task events.

## Project Structure

- `app/api` — Next.js API route handlers for auth, approvals, boards, columns, tasks, notifications, attendance, and more.
- `app/board/[id]` — board workspace and task collaboration route.
- `components/boards` — board canvas, columns, task cards, modals, and board UI.
- `components/profile` — profile dashboard and user settings.
- `components/landing` — landing page UI.
- `store/board-store.ts` — Zustand store for boards, columns, tasks, and backend sync.
- `models` — Mongoose models for User, Board, Column, Task, Notification, and related data.
- `lib` — shared database, auth, API, realtime, mailer, and type utilities.

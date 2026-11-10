# Task Tracker

A small internal app for tracking the full lifecycle of a task between people: who created it, who assigned it to whom, when it was received, what was said, which follow-ups were handed out, and when it was completed.

The current task status is a convenience field. The append-only activity log is the source of truth, and SQLite triggers stop history rows from being deleted or rewritten.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- SQLite via `better-sqlite3` and Drizzle ORM (migrations in `drizzle/`)
- Session cookies (httpOnly, SameSite=Lax) with only a SHA-256 hash of the token stored; passwords hashed with bcrypt

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run db:seed      # creates data/app.db with sample users and tasks
npm run dev          # http://localhost:3000
```

`npm run db:seed -- --reset` deletes and recreates the database. Migrations also run automatically whenever the app opens the database.

### Seeded accounts

All passwords are `changeme123`.

| Email | Role |
| --- | --- |
| admin@example.com | Admin |
| usera@example.com | User A |
| userb@example.com | User B |
| userc@example.com | User C |
| userd@example.com | User D |

Task #1001 "Prepare Project Report" contains the full reference journey: User A creates it and assigns it to User B. User B receives it and asks for financial data, User A replies, and User B assigns a follow-up to User C. User C receives and completes the follow-up with a reply, then User B moves the task to In Progress and completes it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | Type-check |
| `npm run test:lifecycle` | Run the lifecycle scenario against a temporary database and assert the audit trail, permissions, and history guards |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations without starting the app |
| `npm run db:seed` | Seed sample data |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_PATH` | `data/app.db` | SQLite file location |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Dhaka` | Time zone used to display timestamps (all stored in UTC) |

## Lifecycle rules

- Creating a task records `task_created`, and the creator may assign it right away.
- A new primary assignment marks the previous one `superseded` and never removes it. The first assignment sets the task to Assigned, and later ones set it to Reassigned.
- Only the assignee can respond Received or Not Received. Not Received is recorded and leaves the task status unchanged, so they can still mark Received later.
- The creator, the current assignee, or an admin can move a received task to In Progress, Waiting, Completed, or Cancelled. A task cannot be completed while any follow-up is still open.
- Follow-ups live inside the parent task. The person they are assigned to can mark them Received, Not Received, In Progress, and Completed, and every one of those events is recorded on the parent task.
- Completed and cancelled tasks are read-only. Their messages, assignments, and activities stay visible.
- Normal users see tasks they created, were assigned (including follow-ups), assigned to someone else, or messaged on. Admins see everything.
- Admins can deactivate a user (sessions end; history kept) or **delete** a user permanently. Deletion removes their account, notifications, and every task they touched (entire task records for anyone else on those tasks). You cannot delete yourself or the last active admin.

## Project layout

```text
src/
  app/                 routes: /login, / (dashboard), /tasks/new, /tasks/[id], /notifications, /admin/*, /api/*
  components/          shared UI (table, timeline, assignment chain, dialogs, badges)
  db/                  Drizzle schema and connection
  lib/                 constants, formatting, errors, clock
  server/              domain logic: auth, users, tasks (mutations), task-queries (reads), notifications
drizzle/               SQL migrations, including the history-guard triggers
scripts/               seed, migrate, and lifecycle test
```

import { getDb } from "../src/db";
import { users } from "../src/db/schema";
import { setClock } from "../src/lib/clock";
import { hashPassword, type SessionUser } from "../src/server/auth";
import {
  acknowledgeAssignment,
  addMessage,
  assignFollowUp,
  assignTask,
  changeTaskStatus,
  createTask,
  updateFollowUpStatus,
} from "../src/server/tasks";

export const DEFAULT_PASSWORD = "changeme123";

/** Wall-clock time on 10 Nov 2026 in Asia/Dhaka (UTC+06:00). */
export function at(hhmm: string, day = "2026-11-10") {
  return new Date(`${day}T${hhmm}:00+06:00`);
}

export function freezeAt(date: Date) {
  setClock(() => date);
}

export async function createSeedUsers() {
  const db = getDb();
  const hash = await hashPassword(DEFAULT_PASSWORD);
  const ts = at("08:00").toISOString();
  const rows = [
    { name: "Admin", email: "admin@example.com", role: "admin" as const },
    { name: "User A", email: "usera@example.com", role: "user" as const },
    { name: "User B", email: "userb@example.com", role: "user" as const },
    { name: "User C", email: "userc@example.com", role: "user" as const },
    { name: "User D", email: "userd@example.com", role: "user" as const },
  ];
  const created = rows.map((r) =>
    db
      .insert(users)
      .values({ ...r, passwordHash: hash, createdAt: ts, updatedAt: ts })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role })
      .get(),
  );
  const [admin, a, b, c, d] = created as SessionUser[];
  return { admin, a, b, c, d };
}

export type SeedUsers = Awaited<ReturnType<typeof createSeedUsers>>;

/** The ten-step "Prepare Project Report" journey from the requirements. */
export function runProjectReportScenario({ a, b, c }: SeedUsers, hooks: { beforeFollowUpDone?: () => void } = {}) {
  freezeAt(at("09:00"));
  const task = createTask(a, {
    title: "Prepare Project Report",
    description: "Compile the monthly project report including progress, risks, and the financial summary.",
    priority: "high",
    dueDate: "2026-11-12",
  });

  freezeAt(at("09:05"));
  const primary = assignTask(a, task.id, { assigneeId: b.id });

  freezeAt(at("09:15"));
  acknowledgeAssignment(b, task.id, primary.id, { response: "received" });

  freezeAt(at("09:30"));
  addMessage(b, task.id, { message: "I need the financial data before proceeding." });

  freezeAt(at("09:40"));
  addMessage(a, task.id, { message: "Please coordinate with User C.", recipientId: b.id });

  freezeAt(at("09:50"));
  const followUp = assignFollowUp(b, task.id, { assigneeId: c.id, instruction: "Please provide the financial data." });

  freezeAt(at("10:00"));
  acknowledgeAssignment(c, task.id, followUp.id, { response: "received" });

  hooks.beforeFollowUpDone?.();

  freezeAt(at("11:30"));
  updateFollowUpStatus(c, task.id, followUp.id, { status: "completed", note: "Financial data uploaded." });

  freezeAt(at("11:45"));
  changeTaskStatus(b, task.id, { status: "in_progress" });

  freezeAt(at("14:00"));
  changeTaskStatus(b, task.id, { status: "completed" });

  setClock(null);
  return { taskId: task.id, primaryId: primary.id, followUpId: followUp.id };
}

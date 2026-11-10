import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { notifications, taskActivities, taskAssignments, taskMessages, tasks, users } from "../src/db/schema";
import { setClock } from "../src/lib/clock";
import { AppError } from "../src/lib/errors";
import * as queries from "../src/server/task-queries";
import * as service from "../src/server/tasks";
import { createUser, deleteUser, updateUser } from "../src/server/users";
import { at, createSeedUsers, freezeAt, runProjectReportScenario } from "./scenario";

const tmpDir = path.resolve("data/tmp");
fs.mkdirSync(tmpDir, { recursive: true });
const file = path.join(tmpDir, `lifecycle-${process.pid}.db`);
process.env.DB_PATH = file;

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function expectError(fn: () => unknown, status: number, pattern?: RegExp) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AppError, `expected AppError, got ${err}`);
    assert.equal(err.status, status, err.message);
    if (pattern) assert.match(err.message, pattern);
    return;
  }
  assert.fail("expected the call to be rejected");
}

async function main() {
try {
  const u = await createSeedUsers();
  const { a, b, c, d } = u;
  const db = getDb();

  console.log("Project Report scenario");
  const { taskId, primaryId, followUpId } = runProjectReportScenario(u, {
    beforeFollowUpDone: () => {
      freezeAt(at("10:30"));
      expectError(() => service.changeTaskStatus(b, 1001, { status: "completed" }), 409, /open follow-up/);
      expectError(() => service.updateFollowUpStatus(b, 1001, 2, { status: "completed" }), 403);
    },
  });

  check("task ids start at 1001", () => assert.equal(taskId, 1001));

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get()!;
  check("task is completed by User B at 14:00", () => {
    assert.equal(task.status, "completed");
    assert.equal(task.completedBy, b.id);
    assert.equal(task.completedAt, at("14:00").toISOString());
    assert.equal(task.createdBy, a.id);
    assert.equal(task.currentAssignee, b.id);
  });

  const activities = db
    .select()
    .from(taskActivities)
    .where(eq(taskActivities.taskId, taskId))
    .orderBy(asc(taskActivities.createdAt), asc(taskActivities.id))
    .all();

  check("activity timeline records every step in order", () => {
    assert.deepEqual(
      activities.map((x) => x.activityType),
      [
        "task_created",
        "task_assigned",
        "task_received",
        "message_added",
        "message_added",
        "follow_up_assigned",
        "follow_up_received",
        "follow_up_completed",
        "message_added",
        "status_changed",
        "task_completed",
      ],
    );
  });

  check("each step names the responsible user", () => {
    assert.deepEqual(
      activities.map((x) => x.userId),
      [a.id, a.id, b.id, b.id, a.id, b.id, c.id, c.id, c.id, b.id, b.id],
    );
  });

  check("each step keeps its exact timestamp", () => {
    assert.deepEqual(
      activities.map((x) => x.createdAt),
      ["09:00", "09:05", "09:15", "09:30", "09:40", "09:50", "10:00", "11:30", "11:30", "11:45", "14:00"].map((t) =>
        at(t).toISOString(),
      ),
    );
  });

  check("activity descriptions read as sentences", () => {
    assert.equal(activities[0].description, "User A created Task #1001: “Prepare Project Report”");
    assert.equal(activities[1].description, "User A assigned the task to User B");
    assert.equal(activities[2].description, "User B received the task from User A");
    assert.equal(activities[5].description, "User B assigned a follow-up action to User C: “Please provide the financial data.”");
    assert.equal(activities[9].description, "User B changed status from Received to In Progress");
    assert.equal(activities[10].description, "User B marked Task #1001 as Completed");
  });

  const assignments = db.select().from(taskAssignments).where(eq(taskAssignments.taskId, taskId)).orderBy(asc(taskAssignments.id)).all();
  check("primary and follow-up assignments are both preserved", () => {
    assert.equal(assignments.length, 2);
    const [p, f] = assignments;
    assert.equal(p.id, primaryId);
    assert.deepEqual(
      [p.assignmentType, p.assignedBy, p.assignedTo, p.status, p.assignedAt, p.receivedAt, p.completedAt],
      ["primary", a.id, b.id, "completed", at("09:05").toISOString(), at("09:15").toISOString(), at("14:00").toISOString()],
    );
    assert.equal(f.id, followUpId);
    assert.deepEqual(
      [f.assignmentType, f.assignedBy, f.assignedTo, f.instruction, f.status, f.receivedAt, f.completedAt],
      [
        "follow_up",
        b.id,
        c.id,
        "Please provide the financial data.",
        "completed",
        at("10:00").toISOString(),
        at("11:30").toISOString(),
      ],
    );
  });

  check("follow-up reply is linked to the follow-up assignment", () => {
    const reply = db.select().from(taskMessages).where(eq(taskMessages.assignmentId, followUpId)).get()!;
    assert.equal(reply.message, "Financial data uploaded.");
    assert.equal(reply.senderId, c.id);
    assert.equal(reply.recipientId, b.id);
  });

  check("completed task rejects new messages, assignments, follow-ups, and status changes", () => {
    expectError(() => service.addMessage(a, taskId, { message: "One more thing" }), 409, /locked/);
    expectError(() => service.assignTask(b, taskId, { assigneeId: c.id }), 409);
    expectError(() => service.assignFollowUp(b, taskId, { assigneeId: c.id, instruction: "x" }), 409);
    expectError(() => service.changeTaskStatus(a, taskId, { status: "cancelled" }), 409);
    expectError(() => service.updateTask(a, taskId, { title: "Renamed" }), 409);
  });

  check("database refuses to delete or rewrite history", () => {
    assert.throws(() => db.delete(taskActivities).where(eq(taskActivities.taskId, taskId)).run(), /immutable/);
    assert.throws(() => db.update(taskActivities).set({ description: "edited" }).run(), /immutable/);
    assert.throws(() => db.delete(taskMessages).run(), /immutable/);
    assert.throws(() => db.delete(tasks).where(eq(tasks.id, taskId)).run(), /permanent/);
    assert.throws(() => db.delete(taskAssignments).run(), /permanent/);
    assert.throws(
      () => db.update(taskAssignments).set({ receivedAt: new Date().toISOString() }).where(eq(taskAssignments.id, primaryId)).run(),
      /cannot be rewritten/,
    );
    assert.throws(() => db.update(tasks).set({ completedBy: a.id }).where(eq(tasks.id, taskId)).run(), /cannot be rewritten/);
  });

  check("an unrelated user cannot see the task", () => {
    expectError(() => queries.getTaskDetail(d, taskId), 404);
    assert.equal(queries.listTasks(d).rows.some((r) => r.id === taskId), false);
    assert.equal(queries.listTasks(c).rows.some((r) => r.id === taskId), true);
    assert.equal(queries.listTasks(u.admin).rows.some((r) => r.id === taskId), true);
  });

  check("participants were notified", () => {
    const forUser = (id: number) => db.select().from(notifications).where(eq(notifications.userId, id)).all().map((n) => n.type);
    assert.ok(forUser(b.id).includes("assigned"));
    assert.ok(forUser(c.id).includes("follow_up"));
    assert.ok(forUser(b.id).includes("follow_up_completed"));
    assert.ok(forUser(a.id).includes("completed"));
    assert.ok(forUser(a.id).includes("message"));
    assert.equal(forUser(d.id).length, 0);
  });

  check("task detail exposes the full chain for the UI", () => {
    const detail = queries.getTaskDetail(c, taskId);
    assert.equal(detail.assignments.length, 2);
    assert.equal(detail.activities.length, 11);
    assert.equal(detail.permissions.canMessage, false);
    assert.equal(detail.permissions.statusOptions.length, 0);
    assert.equal(detail.activities[3].message?.body, "I need the financial data before proceeding.");
  });

  console.log("Other lifecycle rules");
  setClock(null);

  check("Not Received is recorded without changing the task status, and can be followed by Received", () => {
    const t = service.createTask(a, { title: "Collect signatures", assigneeId: d.id });
    const asg = db.select().from(taskAssignments).where(eq(taskAssignments.taskId, t.id)).get()!;
    service.acknowledgeAssignment(d, t.id, asg.id, { response: "not_received", note: "I was not given the folder." });
    assert.equal(db.select().from(tasks).where(eq(tasks.id, t.id)).get()!.status, "assigned");
    assert.equal(db.select().from(taskAssignments).where(eq(taskAssignments.id, asg.id)).get()!.status, "not_received");
    expectError(() => service.changeTaskStatus(d, t.id, { status: "in_progress" }), 409);
    service.acknowledgeAssignment(d, t.id, asg.id, { response: "received" });
    assert.equal(db.select().from(tasks).where(eq(tasks.id, t.id)).get()!.status, "received");
    const types = db.select().from(taskActivities).where(eq(taskActivities.taskId, t.id)).all().map((x) => x.activityType);
    assert.deepEqual(types, ["task_created", "task_assigned", "task_not_received", "message_added", "task_received"]);
    expectError(() => service.acknowledgeAssignment(d, t.id, asg.id, { response: "received" }), 409);
  });

  check("reassignment supersedes the previous assignment and keeps it", () => {
    const t = service.createTask(a, { title: "Draft policy", assigneeId: b.id });
    service.assignTask(a, t.id, { assigneeId: c.id, instruction: "B is on leave" });
    const rows = db.select().from(taskAssignments).where(eq(taskAssignments.taskId, t.id)).orderBy(asc(taskAssignments.id)).all();
    assert.deepEqual(
      rows.map((r) => [r.assignedTo, r.status]),
      [
        [b.id, "superseded"],
        [c.id, "pending"],
      ],
    );
    const row = db.select().from(tasks).where(eq(tasks.id, t.id)).get()!;
    assert.equal(row.status, "reassigned");
    assert.equal(row.currentAssignee, c.id);
    expectError(() => service.acknowledgeAssignment(b, t.id, rows[0].id, { response: "received" }), 409);
    expectError(() => service.changeTaskStatus(b, t.id, { status: "cancelled" }), 403);
  });

  check("permissions are enforced", () => {
    const t = service.createTask(a, { title: "Book venue", assigneeId: b.id });
    expectError(() => service.assignTask(a, t.id, { assigneeId: a.id }), 400, /yourself/);
    expectError(() => service.addMessage(d, t.id, { message: "hi" }), 404);
    expectError(() => service.addMessage(a, t.id, { message: "fyi", recipientId: d.id }), 400, /people on this task/);
    service.addMessage(a, t.id, { message: "fyi", recipientId: b.id });
    expectError(() => service.updateTask(b, t.id, { title: "x" }), 403);
    const asg = db.select().from(taskAssignments).where(eq(taskAssignments.taskId, t.id)).get()!;
    expectError(() => service.acknowledgeAssignment(a, t.id, asg.id, { response: "received" }), 403);
    service.updateTask(a, t.id, { title: "Book venue for offsite" });
    const edit = db.select().from(taskActivities).where(eq(taskActivities.taskId, t.id)).all().at(-1)!;
    assert.equal(edit.activityType, "task_updated");
    assert.deepEqual((edit.metadata as { changes: unknown }).changes, { title: { from: "Book venue", to: "Book venue for offsite" } });
  });

  await (async () => {
    await assert.rejects(() => updateUser(u.admin, u.admin.id, { isActive: false }), /your own account/);
    await assert.rejects(() => updateUser(u.admin, u.admin.id, { role: "user" }), /your own account/);
    await assert.rejects(() => updateUser(a, d.id, { isActive: false }), /permission/);
    assert.throws(() => deleteUser(u.admin, u.admin.id), /your own account/);
    passed += 1;
    console.log("  ok  admins cannot lock themselves out and users cannot manage accounts");
  })();

  await (async () => {
    const disposable = await createUser(u.admin, {
      name: "Disposable",
      email: "disposable@example.com",
      password: "changeme123",
      role: "user",
    });
    const onlyTheirs = service.createTask(disposable, { title: "Disposable task", assigneeId: a.id });
    const shared = service.createTask(a, { title: "Shared with disposable", assigneeId: disposable.id });
    service.addMessage(a, shared.id, { message: "Please handle", recipientId: disposable.id });

    const summary = deleteUser(u.admin, disposable.id);
    assert.ok(summary.deletedTaskIds.includes(onlyTheirs.id));
    assert.ok(summary.deletedTaskIds.includes(shared.id));
    assert.equal(db.select().from(users).where(eq(users.id, disposable.id)).get(), undefined);
    assert.equal(db.select().from(tasks).where(eq(tasks.id, onlyTheirs.id)).get(), undefined);
    assert.equal(db.select().from(tasks).where(eq(tasks.id, shared.id)).get(), undefined);
    assert.equal(
      db
        .select()
        .from(notifications)
        .all()
        .some((n) => n.userId === disposable.id),
      false,
    );
    passed += 1;
    console.log("  ok  deleting a user removes their tasks and related history");
  })();

  check("dashboard counts reflect each user's work", () => {
    const counts = queries.dashboardCounts(d);
    assert.equal(counts.assigned, 1);
    assert.equal(counts.pending_ack, 0);
    assert.equal(queries.dashboardCounts(c).pending_ack, 1);
    assert.equal(queries.dashboardCounts(u.admin).completed, 1);
  });

  check("search matches task id and title", () => {
    assert.deepEqual(queries.listTasks(a, { q: "1001" }).rows.map((r) => r.id), [1001]);
    assert.deepEqual(queries.listTasks(a, { q: "#1001" }).rows.map((r) => r.id), [1001]);
    assert.equal(queries.listTasks(a, { q: "project report" }).rows.length, 1);
    assert.equal(queries.listTasks(a, { q: "100%" }).rows.length, 0);
    assert.equal(queries.listTasks(a, { status: "completed" }).rows.length, 1);
    assert.equal(queries.listTasks(a, { from: "2026-11-10", to: "2026-11-10" }).rows.some((r) => r.id === 1001), true);
    assert.equal(queries.listTasks(a, { from: "2026-11-09", to: "2026-11-09" }).rows.length, 0);
    assert.equal(queries.listTasks(a, { from: "2026-11-11", to: "2026-11-11" }).rows.some((r) => r.id === 1001), false);
  });

  console.log(`\n${passed} checks passed`);
} finally {
  setClock(null);
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

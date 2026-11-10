import { and, eq, inArray, or } from "drizzle-orm";
import type { DB } from "@/db";
import {
  notifications,
  taskActivities,
  taskAssignments,
  taskMessages,
  tasks,
  TERMINAL_STATUSES,
  users,
  type ActivityType,
  type Task,
} from "@/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";

export type Tx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export function loadTask(tx: Tx, taskId: number): Task {
  const task = tx.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task) throw notFound("Task not found");
  return task;
}

export function requireActiveUser(tx: Tx, userId: number) {
  const user = tx
    .select({ id: users.id, name: users.name, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!user) throw badRequest("Selected user does not exist");
  if (!user.isActive) throw badRequest(`${user.name} is inactive and cannot receive work`);
  return user;
}

export function userName(tx: Tx, userId: number | null | undefined) {
  if (!userId) return "Unassigned";
  return tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).get()?.name ?? `User #${userId}`;
}

export function isInvolved(tx: Tx, userId: number, task: Task) {
  if (task.createdBy === userId || task.currentAssignee === userId) return true;
  const assignment = tx
    .select({ id: taskAssignments.id })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.taskId, task.id),
        or(eq(taskAssignments.assignedTo, userId), eq(taskAssignments.assignedBy, userId)),
      ),
    )
    .get();
  if (assignment) return true;
  const message = tx
    .select({ id: taskMessages.id })
    .from(taskMessages)
    .where(
      and(eq(taskMessages.taskId, task.id), or(eq(taskMessages.senderId, userId), eq(taskMessages.recipientId, userId))),
    )
    .get();
  return !!message;
}

/** Loads a task the actor is allowed to see. Hidden tasks report as not found. */
export function loadVisibleTask(tx: Tx, actor: SessionUser, taskId: number) {
  const task = loadTask(tx, taskId);
  if (actor.role !== "admin" && !isInvolved(tx, actor.id, task)) throw notFound("Task not found");
  return task;
}

export function isTerminal(task: Pick<Task, "status">) {
  return TERMINAL_STATUSES.includes(task.status);
}

export function assertOpen(task: Task) {
  if (isTerminal(task)) throw conflict(`Task #${task.id} is ${task.status} and its history is locked`);
}

/** Creator, current assignee, or an admin may steer the task. */
export function isManager(actor: SessionUser, task: Task) {
  return actor.role === "admin" || task.createdBy === actor.id || task.currentAssignee === actor.id;
}

export function assertManager(actor: SessionUser, task: Task, action: string) {
  if (!isManager(actor, task)) throw forbidden(`Only the creator, current assignee, or an admin can ${action}`);
}

export function recordActivity(
  tx: Tx,
  entry: {
    taskId: number;
    userId: number;
    type: ActivityType;
    description: string;
    at: string;
    metadata?: Record<string, unknown>;
  },
) {
  return tx
    .insert(taskActivities)
    .values({
      taskId: entry.taskId,
      userId: entry.userId,
      activityType: entry.type,
      description: entry.description,
      metadata: entry.metadata ?? {},
      createdAt: entry.at,
    })
    .returning()
    .get();
}

export function touchTask(tx: Tx, taskId: number, at: string, changes: Partial<Task> = {}) {
  tx.update(tasks)
    .set({ ...changes, updatedAt: at })
    .where(eq(tasks.id, taskId))
    .run();
}

/** Everyone who has taken part in the task: creator, assigners, assignees, and message participants. */
export function involvedUserIds(tx: Tx, task: Task) {
  const ids = new Set<number>([task.createdBy]);
  if (task.currentAssignee) ids.add(task.currentAssignee);
  for (const a of tx
    .select({ by: taskAssignments.assignedBy, to: taskAssignments.assignedTo })
    .from(taskAssignments)
    .where(eq(taskAssignments.taskId, task.id))
    .all()) {
    ids.add(a.by);
    ids.add(a.to);
  }
  for (const m of tx
    .select({ sender: taskMessages.senderId, recipient: taskMessages.recipientId })
    .from(taskMessages)
    .where(eq(taskMessages.taskId, task.id))
    .all()) {
    ids.add(m.sender);
    if (m.recipient) ids.add(m.recipient);
  }
  return [...ids];
}

export function notify(
  tx: Tx,
  recipients: Iterable<number | null | undefined>,
  actorId: number,
  payload: { taskId: number; type: string; title: string; body?: string; at: string },
) {
  const ids = [...new Set([...recipients].filter((id): id is number => !!id && id !== actorId))];
  if (ids.length === 0) return;
  const active = tx
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.isActive, true)))
    .all();
  for (const { id } of active) {
    tx.insert(notifications)
      .values({
        userId: id,
        taskId: payload.taskId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? "",
        createdAt: payload.at,
      })
      .run();
  }
}

export function quote(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  return `“${clean.length > max ? `${clean.slice(0, max - 1)}…` : clean}”`;
}

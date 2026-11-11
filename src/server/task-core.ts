import { and, eq, inArray, or } from "drizzle-orm";
import type { DB } from "@/db";
import {
  channelMembers,
  notifications,
  taskActivities,
  taskAssignments,
  taskMembers,
  taskMessages,
  tasks,
  TERMINAL_STATUSES,
  users,
  type ActivityType,
  type Task,
} from "@/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";
import { assertChannelMember } from "./channel-access";

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

export function isTaskMember(tx: Tx, taskId: number, userId: number) {
  return !!tx
    .select({ id: taskMembers.id })
    .from(taskMembers)
    .where(and(eq(taskMembers.taskId, taskId), eq(taskMembers.userId, userId)))
    .get();
}

export function listTaskMemberIds(tx: Tx, taskId: number) {
  return tx
    .select({ userId: taskMembers.userId })
    .from(taskMembers)
    .where(eq(taskMembers.taskId, taskId))
    .all()
    .map((r) => r.userId);
}

export function ensureTaskMember(tx: Tx, taskId: number, userId: number, addedBy: number, at: string) {
  if (isTaskMember(tx, taskId, userId)) return;
  tx.insert(taskMembers).values({ taskId, userId, addedBy, createdAt: at }).run();
}

export function listChannelMemberIdsInTx(tx: Tx, channelId: number) {
  return tx
    .select({ userId: channelMembers.userId })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId))
    .all()
    .map((r) => r.userId);
}

/** Everyone on the project can see and open tasks in that project. */
export function ensureProjectMembersOnTask(tx: Tx, taskId: number, channelId: number, addedBy: number, at: string) {
  for (const userId of listChannelMemberIdsInTx(tx, channelId)) {
    ensureTaskMember(tx, taskId, userId, addedBy, at);
  }
}

/** Every active admin is always on the task roster and cannot be removed. */
export function ensureAdminsOnTask(tx: Tx, taskId: number, addedBy: number, at: string) {
  const admins = tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .all();
  for (const a of admins) {
    ensureTaskMember(tx, taskId, a.id, addedBy, at);
  }
}

export function isAdminUser(tx: Tx, userId: number) {
  return tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()?.role === "admin";
}

export function isInvolved(tx: Tx, userId: number, task: Task) {
  return isTaskMember(tx, task.id, userId);
}

/** Loads a task the actor is allowed to see. Hidden tasks report as not found. */
export function loadVisibleTask(tx: Tx, actor: SessionUser, taskId: number) {
  const task = loadTask(tx, taskId);
  assertChannelMember(tx, actor, task.channelId);
  if (actor.role !== "admin" && !isTaskMember(tx, task.id, actor.id)) {
    throw notFound("Task not found");
  }
  return task;
}

export function isTerminal(task: Pick<Task, "status">) {
  return TERMINAL_STATUSES.includes(task.status);
}

export function assertOpen(task: Task) {
  if (isTerminal(task)) throw conflict(`Task #${task.id} is ${task.status} and its history is locked`);
}

/** Admins may change roster, assignments, and details even on completed/cancelled tasks. */
export function assertOpenUnlessAdmin(actor: SessionUser, task: Task) {
  if (actor.role === "admin") return;
  assertOpen(task);
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

/** Users currently on the task roster (for messaging and notifications). */
export function involvedUserIds(tx: Tx, task: Task) {
  return listTaskMemberIds(tx, task.id);
}

export function notify(
  tx: Tx,
  recipients: Iterable<number | null | undefined>,
  actorId: number,
  payload: {
    taskId: number;
    type: string;
    title: string;
    body?: string;
    at: string;
    activityId?: number | null;
    messageId?: number | null;
  },
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
        activityId: payload.activityId ?? null,
        messageId: payload.messageId ?? null,
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

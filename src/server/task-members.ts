import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { taskMembers, users, type Task } from "@/db/schema";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { nowIso } from "@/lib/clock";
import type { SessionUser } from "./auth";
import { assertAssigneeInChannel, assertChannelMember } from "./channel-access";
import {
  assertOpenUnlessAdmin,
  ensureTaskMember,
  isAdminUser,
  isTaskMember,
  listTaskMemberIds,
  loadVisibleTask,
  recordActivity,
  requireActiveUser,
  userName,
  type Tx,
} from "./task-core";
import { listChannelMemberIds } from "./channels";

export type TaskMemberView = {
  userId: number;
  name: string;
  email: string;
  role: "admin" | "user";
  addedAt: string;
  addedByName: string;
};

export function listTaskMembers(actor: SessionUser, taskId: number): TaskMemberView[] {
  const db = getDb();
  loadVisibleTask(db, actor, taskId);
  return listTaskMemberViews(db, taskId);
}

export function listTaskMemberViews(tx: Tx, taskId: number): TaskMemberView[] {
  const rows = tx
    .select({
      userId: taskMembers.userId,
      name: users.name,
      email: users.email,
      role: users.role,
      addedAt: taskMembers.createdAt,
      addedBy: taskMembers.addedBy,
    })
    .from(taskMembers)
    .innerJoin(users, eq(users.id, taskMembers.userId))
    .where(eq(taskMembers.taskId, taskId))
    .orderBy(users.name)
    .all();
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    addedAt: r.addedAt,
    addedByName: userName(tx, r.addedBy),
  }));
}

export function assertCanManageTaskMembers(actor: SessionUser, task: Task) {
  if (actor.role === "admin") return;
  if (task.createdBy === actor.id) return;
  throw forbidden("Only the task creator or an admin can manage people on this task");
}

export function listInvitableTaskUsers(actor: SessionUser, taskId: number) {
  const db = getDb();
  const task = loadVisibleTask(db, actor, taskId);
  assertCanManageTaskMembers(actor, task);
  const memberIds = new Set(listTaskMemberIds(db, task.id));
  const channelIds = new Set(listChannelMemberIds(db, task.channelId));
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, true))
    .all()
    .filter((u) => channelIds.has(u.id) && !memberIds.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function addTaskMember(actor: SessionUser, taskId: number, input: unknown) {
  const userId = typeof input === "object" && input && "userId" in input ? Number((input as { userId: unknown }).userId) : NaN;
  if (!Number.isInteger(userId) || userId <= 0) throw badRequest("Select a valid user");

  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpenUnlessAdmin(actor, task);
    assertCanManageTaskMembers(actor, task);
    const target = requireActiveUser(tx, userId);
    assertChannelMember(tx, actor, task.channelId);
    assertAssigneeInChannel(tx, task.channelId, target.id);
    if (isTaskMember(tx, task.id, target.id)) throw badRequest("That person is already on this task");

    const at = nowIso();
    ensureTaskMember(tx, task.id, target.id, actor.id, at);
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: "task_member_added",
      description: `${actor.name} added ${target.name} to Task #${task.id}`,
      at,
      metadata: { userId: target.id },
    });
    return { members: listTaskMemberViews(tx, task.id) };
  });
}

export function removeTaskMember(actor: SessionUser, taskId: number, userId: number) {
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpenUnlessAdmin(actor, task);
    assertCanManageTaskMembers(actor, task);
    if (userId === task.createdBy) throw badRequest("The task creator cannot be removed");
    if (isAdminUser(tx, userId)) throw badRequest("Admins are on every task and cannot be removed");
    if (!isTaskMember(tx, task.id, userId)) throw notFound("That person is not on this task");

    const name = userName(tx, userId);
    const at = nowIso();
    tx.delete(taskMembers)
      .where(and(eq(taskMembers.taskId, task.id), eq(taskMembers.userId, userId)))
      .run();
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: "task_member_removed",
      description: `${actor.name} removed ${name} from Task #${task.id}. Their earlier messages stay on the task.`,
      at,
      metadata: { userId },
    });
    return { members: listTaskMemberViews(tx, task.id) };
  });
}

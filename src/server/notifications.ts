import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { channels, notifications, tasks } from "@/db/schema";
import { NOTIFICATION_PAGE_SIZE, TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskFocusTarget } from "@/lib/notification-link";
import type { SessionUser } from "./auth";
import { enrichNotificationAnchors } from "./notification-anchor";

const IS_UNREAD = eq(notifications.isRead, false);

export { NOTIFICATION_PAGE_SIZE };

export type NotificationView = {
  id: number;
  userId: number;
  taskId: number | null;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  channelId: number | null;
  channelName: string | null;
  taskTitle: string | null;
  taskStatus: string | null;
  taskStatusLabel: string | null;
  activityId: number | null;
  messageId: number | null;
};

export function listNotifications(user: SessionUser, limit = NOTIFICATION_PAGE_SIZE, offset = 0): NotificationView[] {
  const db = getDb();
  // Do not JOIN here — node:sqlite + Drizzle returns wrong column values for `id`/`title` on joined selects.
  const rows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset)
    .all();

  const taskIds = [...new Set(rows.map((r) => r.taskId).filter((id): id is number => id != null))];
  const taskById = new Map<number, typeof tasks.$inferSelect>();
  const channelById = new Map<number, typeof channels.$inferSelect>();
  if (taskIds.length > 0) {
    const taskRows = db.select().from(tasks).where(inArray(tasks.id, taskIds)).all();
    for (const t of taskRows) taskById.set(t.id, t);
    const channelIds = [...new Set(taskRows.map((t) => t.channelId))];
    if (channelIds.length > 0) {
      const channelRows = db.select().from(channels).where(inArray(channels.id, channelIds)).all();
      for (const c of channelRows) channelById.set(c.id, c);
    }
  }

  const mapped: NotificationView[] = [];
  const seenIds = new Set<number>();
  for (const r of rows) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const task = r.taskId != null ? taskById.get(r.taskId) : undefined;
    const channel = task != null ? channelById.get(task.channelId) : undefined;
    const taskStatus = task?.status ?? null;
    mapped.push({
      id: r.id,
      userId: r.userId,
      taskId: r.taskId,
      type: r.type,
      title: r.title,
      body: r.body,
      isRead: Boolean(r.isRead),
      createdAt: r.createdAt,
      activityId: r.activityId,
      messageId: r.messageId,
      channelId: channel?.id ?? null,
      channelName: channel?.name ?? null,
      taskTitle: task?.title ?? null,
      taskStatus,
      taskStatusLabel: taskStatus
        ? TASK_STATUS_LABELS[taskStatus as keyof typeof TASK_STATUS_LABELS] ?? taskStatus
        : null,
    });
  }
  return enrichNotificationAnchors(db, mapped);
}

export function notificationTotal(user: SessionUser) {
  return (
    getDb()
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .get()?.n ?? 0
  );
}

export function unreadCount(user: SessionUser) {
  return (
    getDb()
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), IS_UNREAD))
      .get()?.n ?? 0
  );
}

export function markRead(user: SessionUser, id: number): boolean {
  const result = getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .run();
  if (result.changes > 0) return true;
  const already = getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id), eq(notifications.isRead, true)))
    .get();
  return !!already;
}

export function markReadLatestForTask(user: SessionUser, taskId: number): boolean {
  const row = getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.taskId, taskId), IS_UNREAD))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(1)
    .get();
  if (!row) return false;
  return markRead(user, row.id);
}

export function markReadByFocus(user: SessionUser, taskId: number, focus: TaskFocusTarget): boolean {
  const db = getDb();
  const base = [eq(notifications.userId, user.id), eq(notifications.taskId, taskId), IS_UNREAD];
  if (focus.kind === "message") {
    const r = db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...base, eq(notifications.messageId, focus.id)))
      .run();
    if (r.changes > 0) return true;
  }
  const activityId = focus.kind === "activity" ? focus.id : null;
  if (activityId) {
    const r = db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...base, eq(notifications.activityId, activityId)))
      .run();
    if (r.changes > 0) return true;
  }
  return markReadLatestForTask(user, taskId);
}

/** Match by message/activity when notification.task_id points at an older reopened task row. */
export function markReadByFocusLoose(user: SessionUser, focus: TaskFocusTarget): boolean {
  const db = getDb();
  const base = [eq(notifications.userId, user.id), IS_UNREAD];
  if (focus.kind === "message") {
    const r = db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...base, eq(notifications.messageId, focus.id)))
      .run();
    if (r.changes > 0) return true;
  }
  if (focus.kind === "activity") {
    const r = db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...base, eq(notifications.activityId, focus.id)))
      .run();
    if (r.changes > 0) return true;
  }
  return false;
}

export function markReadLatestUnread(user: SessionUser): boolean {
  const row = getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), IS_UNREAD))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(1)
    .get();
  if (!row) return false;
  return markRead(user, row.id);
}

export function markAllRead(user: SessionUser) {
  getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), IS_UNREAD))
    .run();
}

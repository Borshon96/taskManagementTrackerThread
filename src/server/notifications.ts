import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import type { SessionUser } from "./auth";

export function listNotifications(user: SessionUser, limit = 100) {
  return getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .all();
}

export function unreadCount(user: SessionUser) {
  return (
    getDb()
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .get()?.n ?? 0
  );
}

export function markRead(user: SessionUser, id: number) {
  getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .run();
}

export function markAllRead(user: SessionUser) {
  getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
    .run();
}

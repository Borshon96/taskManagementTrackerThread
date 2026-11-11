import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { taskActivities, taskMessages } from "@/db/schema";

type Db = ReturnType<typeof getDb>;
import type { NotificationView } from "./notifications";

const NOTIFICATION_ACTIVITY_TYPES: Record<string, string[]> = {
  message: ["message_added"],
  follow_up: ["follow_up_assigned"],
  follow_up_completed: ["follow_up_completed", "follow_up_in_progress"],
  assigned: ["task_assigned", "task_reassigned"],
  acknowledged: ["task_received", "task_not_received", "follow_up_received", "follow_up_not_received"],
  completed: ["task_completed"],
  status: ["status_changed", "task_cancelled", "task_completed", "follow_up_in_progress"],
};

function closestByTime<T extends { createdAt: string }>(rows: T[], at: string): T | null {
  if (rows.length === 0) return null;
  const target = Date.parse(at);
  if (Number.isNaN(target)) return rows[0] ?? null;
  let best = rows[0]!;
  let bestDist = Math.abs(Date.parse(best.createdAt) - target);
  for (const row of rows) {
    const dist = Math.abs(Date.parse(row.createdAt) - target);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return bestDist <= 120_000 ? best : null;
}

/** Fill missing activity_id / message_id for notifications created before migration 0013. */
export function resolveNotificationAnchor(
  db: Db,
  n: Pick<NotificationView, "taskId" | "type" | "body" | "createdAt" | "activityId" | "messageId">,
): { activityId: number | null; messageId: number | null } {
  if (n.activityId || n.messageId) {
    return { activityId: n.activityId, messageId: n.messageId };
  }
  if (!n.taskId) return { activityId: null, messageId: null };

  const activities = db
    .select()
    .from(taskActivities)
    .where(eq(taskActivities.taskId, n.taskId))
    .all();

  if (n.type === "message" && n.body.trim()) {
    const preview = n.body.trim();
    const exact = db
      .select({ id: taskMessages.id, createdAt: taskMessages.createdAt, message: taskMessages.message })
      .from(taskMessages)
      .where(and(eq(taskMessages.taskId, n.taskId), eq(taskMessages.message, preview)))
      .all();
    const onTask = db.select().from(taskMessages).where(eq(taskMessages.taskId, n.taskId)).all();
    const fuzzy = onTask.filter((m) => {
      const text = m.message.trim();
      if (!text) return preview.toLowerCase().includes("attachment");
      return text === preview || text.startsWith(preview) || preview.startsWith(text.slice(0, 200));
    });
    const msg = closestByTime(exact.length > 0 ? exact : fuzzy, n.createdAt) ?? exact[0] ?? fuzzy[0];
    if (msg) {
      const activity =
        activities.find((a) => (a.metadata as { messageId?: number }).messageId === msg.id) ??
        closestByTime(
          activities.filter((a) => a.activityType === "message_added"),
          n.createdAt,
        );
      return { activityId: activity?.id ?? null, messageId: msg.id };
    }
  }

  const types = NOTIFICATION_ACTIVITY_TYPES[n.type];
  const pool = types ? activities.filter((a) => types.includes(a.activityType)) : activities;
  const activity = closestByTime(pool.length > 0 ? pool : activities, n.createdAt);
  return { activityId: activity?.id ?? null, messageId: null };
}

export function enrichNotificationAnchors(db: Db, rows: NotificationView[]): NotificationView[] {
  return rows.map((r) => {
    if (r.activityId || r.messageId) return r;
    const resolved = resolveNotificationAnchor(db, r);
    return { ...r, ...resolved };
  });
}

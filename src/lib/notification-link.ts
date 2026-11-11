import type { NotificationView } from "@/server/notifications";

export function notificationTaskHref(n: Pick<NotificationView, "id" | "taskId" | "activityId" | "messageId">) {
  if (!n.taskId) return "/";
  const qs = new URLSearchParams();
  qs.set("from", "notification");
  qs.set("notificationId", String(n.id));
  if (n.activityId) qs.set("focus", `activity-${n.activityId}`);
  else if (n.messageId) qs.set("focus", `message-${n.messageId}`);
  return `/tasks/${n.taskId}?${qs.toString()}`;
}

export function parseNotificationMark(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export type TaskFocusTarget = { kind: "activity" | "message"; id: number };

export function parseTaskFocus(raw: string | string[] | undefined): TaskFocusTarget | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const m = v.match(/^(activity|message)-(\d+)$/);
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { kind: m[1] as "activity" | "message", id };
}

import type { NotificationView } from "@/server/notifications";

export function sortNotifications(items: NotificationView[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/** One row per notification id (keeps the newest `createdAt` if the list was corrupted or merged twice). */
export function dedupeNotifications(items: NotificationView[]): NotificationView[] {
  const byId = new Map<number, NotificationView>();
  for (const n of items) {
    const existing = byId.get(n.id);
    if (!existing || n.createdAt > existing.createdAt) byId.set(n.id, n);
  }
  return sortNotifications([...byId.values()]);
}

export function mergeNotifications(prev: NotificationView[], next: NotificationView[]): NotificationView[] {
  return dedupeNotifications([...prev, ...next]);
}

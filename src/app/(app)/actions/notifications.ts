"use server";

import { revalidatePath } from "next/cache";
import type { TaskFocusTarget } from "@/lib/notification-link";
import { getCurrentUser } from "@/server/session";
import {
  markAllRead,
  markRead,
  markReadByFocus,
  markReadByFocusLoose,
  markReadLatestForTask,
  markReadLatestUnread,
  unreadCount,
} from "@/server/notifications";

export async function markNotificationRead(id: number) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, unread: 0 };
  const ok = markRead(user, id);
  revalidatePath("/", "layout");
  return { ok, unread: unreadCount(user) };
}

export async function markNotificationReadForVisit(
  taskId: number,
  options: { notificationId?: number | null; focus?: TaskFocusTarget | null; fromNotification?: boolean },
) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, unread: 0 };
  let ok = false;
  if (options.notificationId) ok = markRead(user, options.notificationId);
  else if (options.fromNotification && options.focus) {
    ok =
      markReadByFocus(user, taskId, options.focus) ||
      markReadByFocusLoose(user, options.focus) ||
      markReadLatestForTask(user, taskId);
  } else if (options.fromNotification) {
    ok = markReadLatestForTask(user, taskId) || markReadLatestUnread(user);
  }
  if (ok) revalidatePath("/", "layout");
  return { ok, unread: unreadCount(user) };
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, unread: 0 };
  markAllRead(user);
  revalidatePath("/", "layout");
  return { ok: true, unread: 0 };
}

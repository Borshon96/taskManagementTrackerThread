import { NOTIFICATION_PAGE_SIZE, listNotifications, notificationTotal, unreadCount } from "@/server/notifications";
import { route } from "@/server/http";

function pageParam(raw: string | null, fallback: number) {
  const n = raw === null ? fallback : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export const GET = route(({ user, req }) => {
  const limit = Math.min(pageParam(req.nextUrl.searchParams.get("limit"), NOTIFICATION_PAGE_SIZE), 50);
  const offset = pageParam(req.nextUrl.searchParams.get("offset"), 0);
  const total = notificationTotal(user);
  const items = listNotifications(user, limit, offset);
  return {
    notifications: items,
    unread: unreadCount(user),
    total,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length,
  };
});

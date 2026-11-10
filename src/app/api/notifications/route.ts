import { route } from "@/server/http";
import { listNotifications, unreadCount } from "@/server/notifications";

export const GET = route(({ user }) => ({ notifications: listNotifications(user), unread: unreadCount(user) }));

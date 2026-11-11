import { intParam, route } from "@/server/http";
import { markRead, unreadCount } from "@/server/notifications";

export const POST = route<{ id: string }>(({ user, params }) => {
  markRead(user, intParam(params.id));
  return { ok: true, unread: unreadCount(user) };
});

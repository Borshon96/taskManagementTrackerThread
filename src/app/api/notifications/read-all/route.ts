import { route } from "@/server/http";
import { markAllRead } from "@/server/notifications";

export const POST = route(({ user }) => {
  markAllRead(user);
});

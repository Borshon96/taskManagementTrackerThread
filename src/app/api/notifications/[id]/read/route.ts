import { intParam, route } from "@/server/http";
import { markRead } from "@/server/notifications";

export const POST = route<{ id: string }>(({ user, params }) => {
  markRead(user, intParam(params.id));
});

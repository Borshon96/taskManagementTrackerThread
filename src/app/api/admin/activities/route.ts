import { route } from "@/server/http";
import { listAllActivities } from "@/server/task-queries";

export const GET = route(
  ({ req, user }) => {
    const p = req.nextUrl.searchParams;
    const num = (k: string) => (Number(p.get(k)) > 0 ? Number(p.get(k)) : undefined);
    return listAllActivities(user, {
      page: num("page"),
      taskId: num("task"),
      userId: num("user"),
      type: p.get("type") || undefined,
    });
  },
  { admin: true },
);

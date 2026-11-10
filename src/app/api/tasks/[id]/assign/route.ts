import { intParam, readJson, route } from "@/server/http";
import { assignTask } from "@/server/tasks";

export const POST = route<{ id: string }>(async ({ req, user, params }) => ({
  assignment: assignTask(user, intParam(params.id), await readJson(req)),
}));

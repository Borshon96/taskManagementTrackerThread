import { intParam, readJson, route } from "@/server/http";
import { changeTaskStatus } from "@/server/tasks";

export const POST = route<{ id: string }>(async ({ req, user, params }) => ({
  task: changeTaskStatus(user, intParam(params.id), await readJson(req)),
}));

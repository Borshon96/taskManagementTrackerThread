import { intParam, readJson, route } from "@/server/http";
import { getTaskDetail } from "@/server/task-queries";
import { updateTask } from "@/server/tasks";

type P = { id: string };

export const GET = route<P>(({ user, params }) => getTaskDetail(user, intParam(params.id)));

export const PATCH = route<P>(async ({ req, user, params }) => ({
  task: updateTask(user, intParam(params.id), await readJson(req)),
}));

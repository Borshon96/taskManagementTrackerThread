import { intParam, readJson, route } from "@/server/http";
import { reopenTask } from "@/server/task-reopen";

export const POST = route<{ id: string }>(async ({ req, user, params }) => reopenTask(user, intParam(params.id), await readJson(req)));

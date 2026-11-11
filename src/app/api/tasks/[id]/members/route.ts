import { intParam, readJson, route } from "@/server/http";
import { addTaskMember } from "@/server/task-members";

export const POST = route<{ id: string }>(async ({ req, user, params }) => addTaskMember(user, intParam(params.id), await readJson(req)));

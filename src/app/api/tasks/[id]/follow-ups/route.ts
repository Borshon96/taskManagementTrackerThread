import { intParam, readJson, route } from "@/server/http";
import { assignFollowUp } from "@/server/tasks";

export const POST = route<{ id: string }>(async ({ req, user, params }) => ({
  assignment: assignFollowUp(user, intParam(params.id), await readJson(req)),
}));

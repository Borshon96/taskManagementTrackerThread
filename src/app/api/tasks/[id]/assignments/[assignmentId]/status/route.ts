import { intParam, readJson, route } from "@/server/http";
import { updateFollowUpStatus } from "@/server/tasks";

export const POST = route<{ id: string; assignmentId: string }>(async ({ req, user, params }) => {
  updateFollowUpStatus(user, intParam(params.id), intParam(params.assignmentId), await readJson(req));
});

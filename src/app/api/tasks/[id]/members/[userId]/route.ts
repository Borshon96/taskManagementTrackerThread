import { intParam, route } from "@/server/http";
import { removeTaskMember } from "@/server/task-members";

export const DELETE = route<{ id: string; userId: string }>(({ user, params }) =>
  removeTaskMember(user, intParam(params.id), intParam(params.userId)),
);

import { intParam, readJson, route } from "@/server/http";
import { addMessage } from "@/server/tasks";

export const POST = route<{ id: string }>(async ({ req, user, params }) => ({
  message: addMessage(user, intParam(params.id), await readJson(req)),
}));

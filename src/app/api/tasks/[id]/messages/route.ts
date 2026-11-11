import { intParam, route } from "@/server/http";
import { parseMessagePayload } from "@/server/message-upload";
import { postTaskMessage } from "@/server/message-post";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const taskId = intParam(params.id);
  const { input, files } = await parseMessagePayload(req);
  return { message: postTaskMessage(user, taskId, input, files) };
});

import type { SessionUser } from "./auth";
import type { IncomingAttachment } from "./attachments";
import { addMessage } from "./tasks";

/** Post a task message (Turbopack-safe entry for the messages API). */
export function postTaskMessage(actor: SessionUser, taskId: number, input: unknown, files: IncomingAttachment[] = []) {
  return addMessage(actor, taskId, input, files);
}

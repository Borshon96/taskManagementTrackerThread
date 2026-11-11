import type { NextRequest } from "next/server";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { badRequest } from "@/lib/errors";
import type { IncomingAttachment } from "./attachments";

export async function parseMessagePayload(req: NextRequest): Promise<{ input: unknown; files: IncomingAttachment[] }> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const message = String(form.get("message") ?? "").trim();
    const recipientRaw = form.get("recipientId");
    const assignmentRaw = form.get("assignmentId");
    const parentRaw = form.get("parentMessageId");
    const parentActivityRaw = form.get("parentActivityId");
    const inReplyMessageRaw = form.get("inReplyToMessageId");
    const inReplyActivityRaw = form.get("inReplyToActivityId");
    const recipientId =
      recipientRaw === null || recipientRaw === "" ? null : Number(String(recipientRaw));
    const assignmentId =
      assignmentRaw === null || assignmentRaw === "" ? null : Number(String(assignmentRaw));
    const parentMessageId =
      parentRaw === null || parentRaw === "" ? null : Number(String(parentRaw));
    const parentActivityId =
      parentActivityRaw === null || parentActivityRaw === "" ? null : Number(String(parentActivityRaw));
    const inReplyToMessageId =
      inReplyMessageRaw === null || inReplyMessageRaw === "" ? null : Number(String(inReplyMessageRaw));
    const inReplyToActivityId =
      inReplyActivityRaw === null || inReplyActivityRaw === "" ? null : Number(String(inReplyActivityRaw));
    if (recipientId !== null && (!Number.isInteger(recipientId) || recipientId <= 0)) {
      throw badRequest("Invalid recipient");
    }
    if (assignmentId !== null && (!Number.isInteger(assignmentId) || assignmentId <= 0)) {
      throw badRequest("Invalid assignment");
    }
    if (parentMessageId !== null && (!Number.isInteger(parentMessageId) || parentMessageId <= 0)) {
      throw badRequest("Invalid reply target");
    }
    if (parentActivityId !== null && (!Number.isInteger(parentActivityId) || parentActivityId <= 0)) {
      throw badRequest("Invalid reply target");
    }
    if (inReplyToMessageId !== null && (!Number.isInteger(inReplyToMessageId) || inReplyToMessageId <= 0)) {
      throw badRequest("Invalid reference");
    }
    if (inReplyToActivityId !== null && (!Number.isInteger(inReplyToActivityId) || inReplyToActivityId <= 0)) {
      throw badRequest("Invalid reference");
    }

    const files: IncomingAttachment[] = [];
    for (const entry of form.getAll("files")) {
      if (!(entry instanceof File) || entry.size === 0) continue;
      if (entry.size > MAX_ATTACHMENT_BYTES) {
        throw badRequest(`“${entry.name}” is too large. Each file must be 5 MB or less.`);
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      files.push({
        fileName: entry.name,
        mimeType: entry.type || "application/octet-stream",
        buffer,
      });
    }

    return {
      input: {
        message,
        recipientId,
        assignmentId,
        parentMessageId,
        parentActivityId,
        inReplyToMessageId,
        inReplyToActivityId,
      },
      files,
    };
  }

  try {
    return { input: await req.json(), files: [] };
  } catch {
    throw badRequest("Request body must be JSON or multipart form data");
  }
}

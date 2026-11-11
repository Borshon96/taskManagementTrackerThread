import fs from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { messageAttachments, taskMessages } from "@/db/schema";
import {
  attachmentKind,
  isAllowedAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  sanitizeFileName,
  type AttachmentKind,
} from "@/lib/attachments";
import { badRequest, notFound } from "@/lib/errors";
import { nowIso } from "@/lib/clock";
import type { SessionUser } from "./auth";
import { loadVisibleTask, type Tx } from "./task-core";

export type IncomingAttachment = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type AttachmentView = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
};

export function uploadsRoot() {
  return path.resolve(process.cwd(), process.env.UPLOADS_PATH ?? "data/uploads");
}

export function validateIncomingAttachments(files: IncomingAttachment[]) {
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw badRequest(`You can attach at most ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`);
  }
  for (const file of files) {
    if (file.buffer.length > MAX_ATTACHMENT_BYTES) {
      throw badRequest(`“${file.fileName}” is too large. Each file must be 5 MB or less.`);
    }
    if (file.buffer.length === 0) throw badRequest(`“${file.fileName}” is empty`);
    if (!isAllowedAttachment(file.fileName)) {
      throw badRequest(
        `“${file.fileName}” is not an allowed type. Use images, video, audio, PDF, CSV, Excel, or Word files.`,
      );
    }
  }
}

export function persistMessageAttachments(tx: Tx, messageId: number, files: IncomingAttachment[], at: string) {
  if (files.length === 0) return [] as AttachmentView[];
  const root = uploadsRoot();
  const dir = path.join(root, String(messageId));
  fs.mkdirSync(dir, { recursive: true });

  const saved: AttachmentView[] = [];
  try {
    for (const file of files) {
      const safeName = sanitizeFileName(file.fileName);
      const row = tx
        .insert(messageAttachments)
        .values({
          messageId,
          fileName: safeName,
          mimeType: file.mimeType.split(";")[0]?.trim() || "application/octet-stream",
          sizeBytes: file.buffer.length,
          storageKey: "",
          createdAt: at,
        })
        .returning()
        .get();
      const storageKey = `${messageId}/${row.id}-${safeName}`;
      const fullPath = path.join(root, storageKey);
      fs.writeFileSync(fullPath, file.buffer);
      tx.update(messageAttachments).set({ storageKey }).where(eq(messageAttachments.id, row.id)).run();
      saved.push({
        id: row.id,
        fileName: safeName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        kind: attachmentKind(safeName, row.mimeType),
      });
    }
    return saved;
  } catch (err) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function attachmentFilePath(storageKey: string) {
  return path.join(uploadsRoot(), storageKey);
}

export function getAttachmentForDownload(actor: SessionUser, attachmentId: number) {
  const db = getDb();
  const row = db.select().from(messageAttachments).where(eq(messageAttachments.id, attachmentId)).get();
  if (!row) throw notFound("Attachment not found");

  const msg = db.select().from(taskMessages).where(eq(taskMessages.id, row.messageId)).get();
  if (!msg) throw notFound("Attachment not found");

  loadVisibleTask(db, actor, msg.taskId);

  const fullPath = attachmentFilePath(row.storageKey);
  if (!fs.existsSync(fullPath)) throw notFound("File is missing");

  return {
    path: fullPath,
    fileName: row.fileName,
    mimeType: row.mimeType,
    kind: attachmentKind(row.fileName, row.mimeType),
  };
}

export function readAttachmentsForMessages(db: ReturnType<typeof getDb>, messageIds: number[]) {
  if (messageIds.length === 0) return new Map<number, AttachmentView[]>();
  const all = db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, messageIds)).all();

  const map = new Map<number, AttachmentView[]>();
  for (const r of all) {
    const view: AttachmentView = {
      id: r.id,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      kind: attachmentKind(r.fileName, r.mimeType),
    };
    const list = map.get(r.messageId) ?? [];
    list.push(view);
    map.set(r.messageId, list);
  }
  return map;
}

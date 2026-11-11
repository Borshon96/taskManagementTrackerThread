export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 8;

export type AttachmentKind = "image" | "video" | "audio" | "document";

const EXTENSION_MIME: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".svg": ["image/svg+xml"],
  ".mp4": ["video/mp4"],
  ".webm": ["video/webm"],
  ".mov": ["video/quicktime"],
  ".pdf": ["application/pdf"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".mp3": ["audio/mpeg", "audio/mp3"],
  ".wav": ["audio/wav", "audio/x-wav"],
  ".ogg": ["audio/ogg"],
  ".m4a": ["audio/mp4", "audio/x-m4a"],
};

export function attachmentExtension(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAllowedAttachment(name: string) {
  return attachmentExtension(name) in EXTENSION_MIME;
}

export function attachmentKind(name: string, mimeType: string): AttachmentKind {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = attachmentExtension(name);
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "audio";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) return "image";
  return "document";
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned || "file";
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

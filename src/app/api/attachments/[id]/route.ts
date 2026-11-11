import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { errorResponse, intParam, route } from "@/server/http";
import { getAttachmentForDownload } from "@/server/attachments";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  try {
    const file = getAttachmentForDownload(user, intParam(params.id));
    const data = await readFile(file.path);
    const inline = file.kind === "image" || file.kind === "video" || file.kind === "audio";
    const disposition = `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`;
    return new NextResponse(data, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
});

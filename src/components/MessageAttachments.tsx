import { formatAttachmentSize } from "@/lib/attachments";
import type { AttachmentView } from "@/server/attachments";

export function MessageAttachments({ attachments }: { attachments: AttachmentView[] }) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-2 space-y-2">
      {attachments.map((a) => {
        const url = `/api/attachments/${a.id}`;
        return (
          <li key={a.id} className="text-sm">
            {a.kind === "image" ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="block max-w-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={a.fileName} className="max-h-56 rounded-md border border-slate-200 object-contain" />
                <span className="mt-1 block text-xs text-slate-500">
                  {a.fileName} · {formatAttachmentSize(a.sizeBytes)}
                </span>
              </a>
            ) : a.kind === "video" ? (
              <div>
                <video src={url} controls className="max-h-56 max-w-full rounded-md border border-slate-200" preload="metadata">
                  <track kind="captions" />
                </video>
                <a href={url} download={a.fileName} className="mt-1 block text-xs text-blue-700 hover:underline">
                  {a.fileName} · {formatAttachmentSize(a.sizeBytes)}
                </a>
              </div>
            ) : a.kind === "audio" ? (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="mb-1 text-xs text-slate-600">
                  {a.fileName} · {formatAttachmentSize(a.sizeBytes)}
                </div>
                <audio src={url} controls className="w-full max-w-md" preload="metadata" />
              </div>
            ) : (
              <a
                href={url}
                download={a.fileName}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50"
              >
                <DocIcon />
                <span>
                  {a.fileName}
                  <span className="block text-xs text-slate-500">{formatAttachmentSize(a.sizeBytes)}</span>
                </span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-slate-400" aria-hidden>
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

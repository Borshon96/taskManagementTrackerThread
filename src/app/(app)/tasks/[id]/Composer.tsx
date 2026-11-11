"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, apiForm } from "@/components/api";
import { Dialog } from "@/components/Dialog";
import type { ReplyTarget } from "@/components/ActivityTimeline";
import { formatAttachmentSize, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/attachments";

type UserOption = { id: number; name: string };

const ACCEPT =
  "image/*,video/*,audio/*,.pdf,.csv,.xls,.xlsx,.doc,.docx,.mp3,.wav,.ogg,.m4a,.mov,.webm";

export function Composer({
  taskId,
  participants,
  users,
  canFollowUp,
  replyTo = null,
  onClearReply,
}: {
  taskId: number;
  participants: UserOption[];
  users: UserOption[];
  canFollowUp: boolean;
  replyTo?: ReplyTarget | null;
  onClearReply?: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignTargets = canFollowUp ? users : participants;
  const showAssign = assignTargets.length > 0;
  const canSend = message.trim().length > 0 || files.length > 0;

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`“${file.name}” is too large. Each file must be 5 MB or less.`);
        continue;
      }
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        setError(`You can attach at most ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function buildForm(
    extra: {
      recipientId?: number | null;
      assignmentId?: number | null;
      parentMessageId?: number | null;
      parentActivityId?: number | null;
      inReplyToMessageId?: number | null;
      inReplyToActivityId?: number | null;
    } = {},
  ) {
    const form = new FormData();
    form.set("message", message.trim());
    if (extra.recipientId) form.set("recipientId", String(extra.recipientId));
    if (extra.assignmentId) form.set("assignmentId", String(extra.assignmentId));
    if (extra.parentMessageId) form.set("parentMessageId", String(extra.parentMessageId));
    if (extra.parentActivityId) form.set("parentActivityId", String(extra.parentActivityId));
    if (extra.inReplyToMessageId) form.set("inReplyToMessageId", String(extra.inReplyToMessageId));
    if (extra.inReplyToActivityId) form.set("inReplyToActivityId", String(extra.inReplyToActivityId));
    for (const file of files) form.append("files", file);
    return form;
  }

  async function postMessage(
    extra: {
      recipientId?: number | null;
      assignmentId?: number | null;
      parentMessageId?: number | null;
      parentActivityId?: number | null;
      inReplyToMessageId?: number | null;
      inReplyToActivityId?: number | null;
    } = {},
  ) {
    if (files.length > 0) {
      await apiForm(`/api/tasks/${taskId}/messages`, buildForm(extra));
    } else {
      await api(`/api/tasks/${taskId}/messages`, {
        message: message.trim(),
        recipientId: extra.recipientId ?? null,
        assignmentId: extra.assignmentId ?? null,
        parentMessageId: extra.parentMessageId ?? null,
        parentActivityId: extra.parentActivityId ?? null,
        inReplyToMessageId: extra.inReplyToMessageId ?? null,
        inReplyToActivityId: extra.inReplyToActivityId ?? null,
      });
    }
  }

  function replyPayload(target: ReplyTarget | null) {
    if (!target) return {};
    if (target.promote) {
      return target.kind === "message"
        ? { inReplyToMessageId: target.messageId }
        : { inReplyToActivityId: target.activityId };
    }
    return target.kind === "message"
      ? { parentMessageId: target.messageId }
      : { parentActivityId: target.activityId };
  }

  function clearComposer() {
    setMessage("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      await postMessage(replyPayload(replyTo));
      clearComposer();
      onClearReply?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openAssign() {
    if (!canSend) return;
    setAssignee("");
    setAssignError(null);
    setAssignOpen(true);
  }

  async function submitAssign() {
    if (!canSend || !assignee) return;
    setBusy(true);
    setAssignError(null);
    try {
      const note = message.trim() || (files.length === 1 ? files[0]!.name : `${files.length} attachments`);
      if (canFollowUp) {
        const { assignment } = await api<{ assignment: { id: number } }>(`/api/tasks/${taskId}/follow-ups`, {
          assigneeId: Number(assignee),
          instruction: note,
        });
        await postMessage({ recipientId: Number(assignee), assignmentId: assignment.id });
      } else {
        await postMessage({ recipientId: Number(assignee) });
      }
      clearComposer();
      setAssignOpen(false);
      setAssignee("");
      router.refresh();
    } catch (err) {
      setAssignError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const previewText =
    message.trim() ||
    (files.length === 0 ? "—" : files.length === 1 ? `Attachment: ${files[0]!.name}` : `${files.length} attachments`);

  return (
    <div aria-label="Message composer">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-blue-800">
              {replyTo.promote ? "New message, referring to" : "Replying to"} {replyTo.authorName}
            </div>
            <div className="truncate text-xs text-blue-900/80">{replyTo.preview}</div>
          </div>
          <button type="button" className="shrink-0 text-xs text-blue-700 hover:text-blue-900" onClick={() => onClearReply?.()}>
            Cancel
          </button>
        </div>
      )}
      <label htmlFor="composer" className="sr-only">
        Write a message
      </label>
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <textarea
          id="composer"
          rows={3}
          maxLength={5000}
          className="input w-full resize-y border-0 bg-transparent p-0 shadow-none focus:ring-0"
          placeholder="Write a message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
        />
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                <span className="max-w-[180px] truncate">{file.name}</span>
                <span className="text-slate-400">{formatAttachmentSize(file.size)}</span>
                <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => removeFile(i)} aria-label="Remove file">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" multiple className="sr-only" accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} />
            <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
              Add file
            </button>
            <span className="text-xs text-slate-500">Max 5 MB · images, docs, media</span>
          </div>
          <div className="flex shrink-0 items-stretch gap-2 sm:justify-end">
            {showAssign && (
              <button
                type="button"
                className="btn-secondary min-w-[5.25rem] flex-1 text-sm sm:flex-none"
                onClick={openAssign}
                disabled={busy || !canSend}
              >
                Assign
              </button>
            )}
            <button
              type="button"
              className="btn-primary min-w-[5.25rem] flex-1 text-sm sm:flex-none"
              onClick={() => void send()}
              disabled={busy || !canSend}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      <Dialog open={assignOpen} onClose={() => !busy && setAssignOpen(false)} title={canFollowUp ? "Assign follow-up" : "Send to user"}>
        <p className="text-sm text-slate-600">
          {canFollowUp
            ? "The text and files below go to the follow-up and the thread for the person you choose."
            : "Send your message and files to one person on this task."}
        </p>
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">
          {previewText}
        </p>
        {files.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {files.length} file{files.length === 1 ? "" : "s"} attached
          </p>
        )}
        <div className="mt-3">
          <label htmlFor="assign-user" className="label">
            User
          </label>
          <select id="assign-user" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Select a user</option>
            {assignTargets.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {canFollowUp && (
          <p className="mt-2 text-xs text-slate-500">The follow-up stays inside this task. The current assignee does not change.</p>
        )}
        {assignError && <p className="mt-2 text-sm text-red-600">{assignError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setAssignOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void submitAssign()} disabled={busy || !assignee}>
            {canFollowUp ? "Assign" : "Send"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

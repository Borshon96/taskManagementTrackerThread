"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { Dialog } from "@/components/Dialog";

type UserOption = { id: number; name: string };

export function Composer({
  taskId,
  participants,
  users,
  canFollowUp,
}: {
  taskId: number;
  participants: UserOption[];
  users: UserOption[];
  canFollowUp: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUser, setFollowUser] = useState("");
  const [instruction, setInstruction] = useState("");
  const [followError, setFollowError] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tasks/${taskId}/messages`, { message, recipientId: recipient || null });
      setMessage("");
      setRecipient("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function assignFollowUp() {
    setBusy(true);
    setFollowError(null);
    try {
      await api(`/api/tasks/${taskId}/follow-ups`, { assigneeId: followUser, instruction });
      setFollowUpOpen(false);
      setFollowUser("");
      setInstruction("");
      router.refresh();
    } catch (err) {
      setFollowError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="border-t border-slate-200 pt-4" aria-label="Message composer">
      <label htmlFor="composer" className="sr-only">
        Write a message
      </label>
      <textarea
        id="composer"
        rows={3}
        maxLength={5000}
        className="input"
        placeholder="Write a message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          To
          <select className="input w-auto py-1 text-xs" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <option value="">Everyone on this task</option>
            {participants.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          {canFollowUp && (
            <button type="button" className="btn-secondary" onClick={() => setFollowUpOpen(true)} disabled={busy}>
              Assign Follow-up
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={busy || !message.trim()}>
            Send
          </button>
        </div>
      </div>

      <Dialog open={followUpOpen} onClose={() => setFollowUpOpen(false)} title="Assign follow-up">
        <div className="space-y-3">
          <div>
            <label htmlFor="follow-user" className="label">
              User
            </label>
            <select id="follow-user" className="input" value={followUser} onChange={(e) => setFollowUser(e.target.value)}>
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="follow-instruction" className="label">
              Instruction
            </label>
            <textarea
              id="follow-instruction"
              rows={3}
              maxLength={5000}
              className="input"
              placeholder="Please verify the attached document."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">The follow-up stays inside this task. The current assignee does not change.</p>
          {followError && <p className="text-sm text-red-600">{followError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setFollowUpOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={assignFollowUp} disabled={busy || !followUser || !instruction.trim()}>
              Assign
            </button>
          </div>
        </div>
      </Dialog>
    </form>
  );
}

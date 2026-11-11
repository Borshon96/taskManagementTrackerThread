"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { Dialog } from "@/components/Dialog";

export function ReopenTask({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ task: { id: number } }>(`/api/tasks/${taskId}/reopen`, { note: note.trim() || undefined });
      setOpen(false);
      router.push(`/tasks/${result.task.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4" aria-label="Reopen task">
      <h2 className="mb-2 text-sm font-semibold">Reopen</h2>
      <p className="mb-3 text-sm text-slate-600">
        Start a new task with the same details. This task stays closed and its history is preserved.
      </p>
      <button type="button" className="btn-primary w-full" onClick={() => setOpen(true)}>
        Reopen as new task
      </button>

      <Dialog open={open} title="Reopen as new task" onClose={() => !busy && setOpen(false)}>
          <p className="text-sm text-slate-600">
            Task #{taskId} will remain {` `}
            <span className="font-medium">closed</span>. A fresh task opens with a clean activity timeline.
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Note for the new task (optional)
            <textarea
              className="input mt-1 min-h-[80px] w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={5000}
              placeholder="Why are you reopening?"
            />
          </label>
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "Creating…" : "Create new task"}
            </button>
          </div>
      </Dialog>
    </section>
  );
}

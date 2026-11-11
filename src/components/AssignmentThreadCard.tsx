"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { ConfirmDialog } from "@/components/Dialog";
import type { AssignmentThreadAction } from "@/lib/assignment-thread";

export type { AssignmentThreadAction } from "@/lib/assignment-thread";

export function AssignmentThreadCard({ taskId, action }: { taskId: number; action: AssignmentThreadAction }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "not_received" | "complete_follow_up">(null);
  const [note, setNote] = useState("");

  const base = `/api/tasks/${taskId}`;

  async function run(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(url, body);
      setDialog(null);
      setNote("");
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (action.mode === "acknowledge") {
    const followUp = action.assignmentType === "follow_up";
    return (
      <>
        <div className={`rounded-md border p-3 text-sm ${followUp ? "border-blue-200 bg-blue-50/60" : "border-blue-200 bg-blue-50/60"}`}>
          <div className="font-medium text-blue-900">
            {followUp ? "A follow-up is assigned to you" : "This task is assigned to you"}
          </div>
          <div className="text-xs text-blue-800">
            From {action.assignedByName}
            {action.status === "not_received" && " · you marked it Not Received"}
          </div>
          {action.instruction && <div className="mt-1 text-sm italic text-slate-700">“{action.instruction}”</div>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void run(`${base}/assignments/${action.assignmentId}/acknowledge`, { response: "received" })}
            >
              Received
            </button>
            {action.status !== "not_received" && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDialog("not_received")}>
                Not Received
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <ConfirmDialog
          open={dialog === "not_received"}
          title="Mark as Not Received?"
          message="The person who assigned this will be notified. You can add a short reason."
          confirmLabel="Not Received"
          tone="danger"
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void run(`${base}/assignments/${action.assignmentId}/acknowledge`, { response: "not_received", note })
          }
        >
          <label className="mt-3 block text-sm">
            <span className="font-medium text-slate-700">Reason (optional)</span>
            <textarea className="input mt-1 w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </ConfirmDialog>
      </>
    );
  }

  return (
    <>
      <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3 text-sm">
        <div className="font-medium text-violet-900">Your follow-up for {action.assignedByName}</div>
        {action.instruction && <div className="mt-1 italic text-slate-700">“{action.instruction}”</div>}
        <div className="mt-2 flex flex-wrap gap-2">
          {action.status === "received" && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void run(`${base}/assignments/${action.assignmentId}/status`, { status: "in_progress" })}
            >
              Start (In Progress)
            </button>
          )}
          <button type="button" className="btn-success" disabled={busy} onClick={() => setDialog("complete_follow_up")}>
            Complete follow-up
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <ConfirmDialog
        open={dialog === "complete_follow_up"}
        title="Complete this follow-up?"
        message="The person who requested it will be notified."
        confirmLabel="Complete follow-up"
        tone="success"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          void run(`${base}/assignments/${action.assignmentId}/status`, { status: "completed", note })
        }
      >
        <label className="mt-3 block text-sm">
          <span className="font-medium text-slate-700">Reply (optional)</span>
          <textarea
            className="input mt-1 w-full"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Financial data uploaded."
          />
        </label>
      </ConfirmDialog>
    </>
  );
}

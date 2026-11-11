"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { AssignmentThreadCard } from "@/components/AssignmentThreadCard";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/lib/constants";

type PendingAck = { id: number; assignmentType: "primary" | "follow_up"; assignedByName: string; instruction: string | null; status: string };
type MyFollowUp = { id: number; status: string; assignedByName: string; instruction: string | null };
type UserOption = { id: number; name: string };

export type TaskActionsProps = {
  taskId: number;
  task: { title: string; description: string; priority: TaskPriority; dueDate: string | null; currentAssignee: number | null };
  statusOptions: TaskStatus[];
  canAssign: boolean;
  canEdit: boolean;
  openFollowUps: number;
  myAcknowledgements: PendingAck[];
  myFollowUps: MyFollowUp[];
  assignees: UserOption[];
};

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      await api(url, body, method);
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

export function TaskActions(props: TaskActionsProps) {
  const { taskId, statusOptions, myAcknowledgements, myFollowUps } = props;
  const { busy, error, setError, run } = useAction();
  const [dialog, setDialog] = useState<null | { kind: "status"; status: TaskStatus } | { kind: "reassign" }>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");

  const open = (d: NonNullable<typeof dialog>) => {
    setNote("");
    setAssignee("");
    setError(null);
    setDialog(d);
  };
  const close = () => setDialog(null);
  const done = (ok: boolean) => ok && close();

  const base = `/api/tasks/${taskId}`;
  const hasAnything =
    myAcknowledgements.length > 0 || myFollowUps.length > 0 || statusOptions.length > 0 || props.canAssign;
  if (!hasAnything) return null;

  const quickStatuses = statusOptions.filter((s) => s === "in_progress" || s === "waiting");

  return (
    <section className="card p-4" aria-label="Actions">
      <h2 className="mb-3 text-sm font-semibold">Actions</h2>

      {myAcknowledgements.map((a) => (
        <div key={a.id} className="mb-3">
          <AssignmentThreadCard
            taskId={taskId}
            action={{
              mode: "acknowledge",
              assignmentId: a.id,
              assignmentType: a.assignmentType,
              assignedByName: a.assignedByName,
              instruction: a.instruction,
              status: a.status,
            }}
          />
        </div>
      ))}

      {myFollowUps.map((f) => (
        <div key={f.id} className="mb-3">
          <AssignmentThreadCard
            taskId={taskId}
            action={{
              mode: "follow_up",
              assignmentId: f.id,
              assignedByName: f.assignedByName,
              instruction: f.instruction,
              status: f.status,
            }}
          />
        </div>
      ))}

      {statusOptions.length > 0 && (
        <div className="mb-3">
          <div className="label">Task status</div>
          <div className="flex flex-wrap gap-2">
            {quickStatuses.map((s) => (
              <button key={s} type="button" className="btn-secondary" disabled={busy} onClick={() => open({ kind: "status", status: s })}>
                {TASK_STATUS_LABELS[s]}
              </button>
            ))}
            {statusOptions.includes("completed") && (
              <button
                type="button"
                className="btn-success"
                disabled={busy || props.openFollowUps > 0}
                title={props.openFollowUps > 0 ? "Close open follow-ups first" : undefined}
                onClick={() => open({ kind: "status", status: "completed" })}
              >
                Mark Completed
              </button>
            )}
            {statusOptions.includes("cancelled") && (
              <button type="button" className="btn-secondary text-red-700" disabled={busy} onClick={() => open({ kind: "status", status: "cancelled" })}>
                Cancel task
              </button>
            )}
          </div>
          {props.openFollowUps > 0 && statusOptions.includes("completed") && (
            <p className="mt-1 text-xs text-slate-500">
              {props.openFollowUps} follow-up{props.openFollowUps === 1 ? " is" : "s are"} still open.
            </p>
          )}
          {!statusOptions.includes("in_progress") && !statusOptions.includes("completed") && (
            <p className="mt-1 text-xs text-slate-500">Work can start once the assignee marks the task Received.</p>
          )}
        </div>
      )}

      {props.canAssign && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => open({ kind: "reassign" })}>
            {props.task.currentAssignee ? "Reassign" : "Assign"}
          </button>
        </div>
      )}

      {error && !dialog && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={dialog?.kind === "status"}
        title={
          dialog?.kind === "status"
            ? dialog.status === "completed"
              ? "Mark this task as Completed?"
              : dialog.status === "cancelled"
                ? "Cancel this task?"
                : `Change status to ${TASK_STATUS_LABELS[dialog.status]}?`
            : ""
        }
        message={
          dialog?.kind === "status" && (dialog.status === "completed" || dialog.status === "cancelled")
            ? "The task becomes read-only. Its full history stays available."
            : "The change is recorded in the activity timeline."
        }
        confirmLabel={
          dialog?.kind === "status"
            ? dialog.status === "completed"
              ? "Mark Completed"
              : dialog.status === "cancelled"
                ? "Cancel task"
                : "Change status"
            : "Confirm"
        }
        tone={dialog?.kind === "status" && dialog.status === "cancelled" ? "danger" : dialog?.kind === "status" && dialog.status === "completed" ? "success" : "primary"}
        busy={busy}
        onClose={close}
        onConfirm={async () => dialog?.kind === "status" && done(await run(`${base}/status`, { status: dialog.status, note }))}
      >
        <NoteField value={note} onChange={setNote} label="Note (optional)" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </ConfirmDialog>

      <Dialog open={dialog?.kind === "reassign"} onClose={close} title={props.task.currentAssignee ? "Reassign task" : "Assign task"}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            done(await run(`${base}/assign`, { assigneeId: assignee, instruction: note }));
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="reassign-user" className="label">
              Assign to
            </label>
            <select id="reassign-user" required className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Select a user</option>
              {props.assignees
                .filter((u) => u.id !== props.task.currentAssignee)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <NoteField value={note} onChange={setNote} label="Note for assignee (optional)" />
          <p className="text-xs text-slate-500">The previous assignment stays in the history.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !assignee}>
              Assign
            </button>
          </div>
        </form>
      </Dialog>

    </section>
  );
}

function NoteField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="mt-3">
      <label className="label">
        {label}
        <textarea
          className="input mt-1 font-normal"
          rows={3}
          maxLength={5000}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

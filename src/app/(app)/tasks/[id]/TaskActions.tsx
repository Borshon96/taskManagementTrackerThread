"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { PRIORITY_LABELS, TASK_PRIORITIES, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/lib/constants";

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
  const [dialog, setDialog] = useState<
    | null
    | { kind: "not_received"; assignmentId: number }
    | { kind: "complete_follow_up"; assignmentId: number }
    | { kind: "status"; status: TaskStatus }
    | { kind: "reassign" }
    | { kind: "edit" }
  >(null);
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
    myAcknowledgements.length > 0 || myFollowUps.length > 0 || statusOptions.length > 0 || props.canAssign || props.canEdit;
  if (!hasAnything) return null;

  const quickStatuses = statusOptions.filter((s) => s === "in_progress" || s === "waiting");

  return (
    <section className="card p-4" aria-label="Actions">
      <h2 className="mb-3 text-sm font-semibold">Actions</h2>

      {myAcknowledgements.map((a) => (
        <div key={a.id} className="mb-3 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-sm">
          <div className="font-medium text-blue-900">
            {a.assignmentType === "primary" ? "This task is assigned to you" : "A follow-up is assigned to you"}
          </div>
          <div className="text-xs text-blue-800">
            From {a.assignedByName}
            {a.status === "not_received" && " · you marked it Not Received"}
          </div>
          {a.instruction && <div className="mt-1 text-sm italic text-slate-700">“{a.instruction}”</div>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => run(`${base}/assignments/${a.id}/acknowledge`, { response: "received" })}
            >
              Received
            </button>
            {a.status !== "not_received" && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => open({ kind: "not_received", assignmentId: a.id })}>
                Not Received
              </button>
            )}
          </div>
        </div>
      ))}

      {myFollowUps.map((f) => (
        <div key={f.id} className="mb-3 rounded-md border border-violet-200 bg-violet-50/60 p-3 text-sm">
          <div className="font-medium text-violet-900">Your follow-up for {f.assignedByName}</div>
          {f.instruction && <div className="mt-1 italic text-slate-700">“{f.instruction}”</div>}
          <div className="mt-2 flex flex-wrap gap-2">
            {f.status === "received" && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => run(`${base}/assignments/${f.id}/status`, { status: "in_progress" })}
              >
                Start (In Progress)
              </button>
            )}
            <button type="button" className="btn-success" disabled={busy} onClick={() => open({ kind: "complete_follow_up", assignmentId: f.id })}>
              Complete follow-up
            </button>
          </div>
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

      {(props.canAssign || props.canEdit) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {props.canAssign && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => open({ kind: "reassign" })}>
              {props.task.currentAssignee ? "Reassign" : "Assign"}
            </button>
          )}
          {props.canEdit && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => open({ kind: "edit" })}>
              Edit details
            </button>
          )}
        </div>
      )}

      {error && !dialog && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={dialog?.kind === "not_received"}
        title="Mark as Not Received?"
        message="This is recorded permanently in the task history. You can still mark it Received later."
        confirmLabel="Mark Not Received"
        tone="danger"
        busy={busy}
        onClose={close}
        onConfirm={async () =>
          dialog?.kind === "not_received" &&
          done(await run(`${base}/assignments/${dialog.assignmentId}/acknowledge`, { response: "not_received", note }))
        }
      >
        <NoteField value={note} onChange={setNote} label="Reason (optional)" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "complete_follow_up"}
        title="Complete this follow-up?"
        message="The person who requested it will be notified."
        confirmLabel="Complete follow-up"
        tone="success"
        busy={busy}
        onClose={close}
        onConfirm={async () =>
          dialog?.kind === "complete_follow_up" &&
          done(await run(`${base}/assignments/${dialog.assignmentId}/status`, { status: "completed", note }))
        }
      >
        <NoteField value={note} onChange={setNote} label="Reply (optional)" placeholder="e.g. Financial data uploaded." />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </ConfirmDialog>

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

      <Dialog open={dialog?.kind === "edit"} onClose={close} title="Edit task details">
        <EditForm task={props.task} busy={busy} error={error} onCancel={close} onSave={async (body) => done(await run(base, body, "PATCH"))} />
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

function EditForm({
  task,
  busy,
  error,
  onCancel,
  onSave,
}: {
  task: TaskActionsProps["task"];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (body: Record<string, FormDataEntryValue>) => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <div>
        <label htmlFor="edit-title" className="label">
          Title
        </label>
        <input id="edit-title" name="title" required maxLength={200} defaultValue={task.title} className="input" />
      </div>
      <div>
        <label htmlFor="edit-description" className="label">
          Description
        </label>
        <textarea id="edit-description" name="description" rows={5} defaultValue={task.description} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-priority" className="label">
            Priority
          </label>
          <select id="edit-priority" name="priority" defaultValue={task.priority} className="input">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="edit-due" className="label">
            Due date
          </label>
          <input id="edit-due" name="dueDate" type="date" defaultValue={task.dueDate ?? ""} className="input" />
        </div>
      </div>
      <p className="text-xs text-slate-500">Previous values are kept in the activity history.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  );
}

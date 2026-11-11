"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TaskMemberView } from "@/server/task-members";
import { api } from "@/components/api";
import { Avatar } from "@/components/ui";

export function TaskMembers({
  taskId,
  taskCreatorId,
  members: initial,
  invitees,
  canManage,
}: {
  taskId: number;
  taskCreatorId: number;
  members: TaskMemberView[];
  invitees: { id: number; name: string; email: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMember(userId: number) {
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: TaskMemberView[] }>(`/api/tasks/${taskId}/members`, { userId });
      setMembers(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: number) {
    if (!confirm("Remove this person from the task? Their past messages will stay in the thread.")) return;
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: TaskMemberView[] }>(
        `/api/tasks/${taskId}/members/${userId}`,
        undefined,
        "DELETE",
      );
      setMembers(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canManage && members.length === 0) return null;

  return (
    <section className="mt-3 border-t border-slate-100 pt-3" aria-label="People on this task">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">People on this task</h3>
      <ul className="space-y-1">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={m.name} id={m.userId} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {m.name}
                  {m.userId === taskCreatorId && (
                    <span className="ml-1 text-[10px] font-normal text-slate-500">(creator)</span>
                  )}
                </span>
                <span className="block truncate text-xs text-slate-500">{m.email}</span>
              </span>
            </span>
            {canManage && m.userId !== taskCreatorId && m.role !== "admin" && (
              <button
                type="button"
                className="shrink-0 text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                disabled={busy}
                onClick={() => void removeMember(m.userId)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && invitees.length > 0 && (
        <div className="mt-2">
          <label htmlFor={`task-add-${taskId}`} className="sr-only">
            Add person to task
          </label>
          <select
            id={`task-add-${taskId}`}
            className="input w-full text-sm"
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id > 0) {
                void addMember(id);
                e.target.value = "";
              }
            }}
          >
            <option value="">Add someone from the project…</option>
            {invitees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {canManage && (
        <p className="mt-2 text-xs text-slate-500">Only the task creator can add or remove people. Removing someone does not delete their messages.</p>
      )}
    </section>
  );
}

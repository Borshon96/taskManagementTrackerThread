"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/constants";

export function NewTaskForm({
  users,
  channelId,
}: {
  users: { id: number; name: string; email: string }[];
  channelId: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);

  function toggleAssignee(userId: number) {
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { task } = await api<{ task: { id: number } }>("/api/tasks", {
        channelId,
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        priority: form.get("priority") || "normal",
        dueDate: String(form.get("dueDate") ?? "") || null,
        assigneeIds,
        instruction: String(form.get("instruction") ?? "").trim() || null,
      });
      router.push(`/tasks/${task.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input id="title" name="title" required maxLength={200} className="input" placeholder="Prepare monthly project report" />
      </div>
      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea id="description" name="description" rows={5} maxLength={10000} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="priority" className="label">
            Priority
          </label>
          <select id="priority" name="priority" defaultValue="normal" className="input">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dueDate" className="label">
            Due date (optional)
          </label>
          <input id="dueDate" name="dueDate" type="date" className="input" />
        </div>
      </div>
      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium text-slate-600">Assign now (optional)</legend>
        <p className="mb-2 text-xs text-slate-500">
          Select one or more people. The first selected becomes the main assignee; others receive a follow-up on this task.
        </p>
        <div>
          <span className="label">Assign to</span>
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">No other project members to assign yet.</p>
          ) : (
            <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {users.map((u) => {
                const selected = assigneeIds.includes(u.id);
                const order = assigneeIds.indexOf(u.id);
                return (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected}
                        onChange={() => toggleAssignee(u.id)}
                      />
                      <span className="min-w-0 flex-1 font-medium text-slate-800">{u.name}</span>
                      {selected && order === 0 && (
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                          Main assignee
                        </span>
                      )}
                      {selected && order > 0 && (
                        <span className="shrink-0 text-[10px] text-slate-500">Follow-up</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="mt-3">
          <label htmlFor="instruction" className="label">
            Note for assignees
          </label>
          <input id="instruction" name="instruction" maxLength={5000} className="input" placeholder="Shared instructions for everyone selected" />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}

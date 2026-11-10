"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/constants";

export function NewTaskForm({ users }: { users: { id: number; name: string; email: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { task } = await api<{ task: { id: number } }>("/api/tasks", Object.fromEntries(form));
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="assigneeId" className="label">
              Assign to
            </label>
            <select id="assigneeId" name="assigneeId" defaultValue="" className="input">
              <option value="">Leave unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="instruction" className="label">
              Note for assignee
            </label>
            <input id="instruction" name="instruction" maxLength={5000} className="input" />
          </div>
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

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { Avatar } from "@/components/ui";
import { formatDate } from "@/lib/format";

type U = { id: number; name: string; email: string; role: "admin" | "user"; isActive: boolean; createdAt: string };

export function UserManager({ users, currentUserId }: { users: U[]; currentUserId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const [toggling, setToggling] = useState<U | null>(null);
  const [deleting, setDeleting] = useState<U | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await api("/api/users", body);
      else if (editing) await api(`/api/users/${editing.id}`, body, "PATCH");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/users/${deleting.id}`, undefined, "DELETE");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!toggling) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/users/${toggling.id}`, { isActive: !toggling.isActive }, "PATCH");
      setToggling(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
        >
          + Add user
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "text-slate-400"}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={u.name} id={u.id} />
                    <span className="font-medium">{u.name}</span>
                    {u.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
                  </span>
                </td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 capitalize">{u.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2">{formatDate(u.createdAt)}</td>
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  <button
                    type="button"
                    className="btn-secondary py-1 text-xs"
                    onClick={() => {
                      setError(null);
                      setEditing(u);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary w-24 py-1 text-xs"
                    disabled={u.id === currentUserId}
                    title={u.id === currentUserId ? "You cannot deactivate your own account" : undefined}
                    onClick={() => {
                      setError(null);
                      setToggling(u);
                    }}
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary py-1 text-xs text-red-700"
                    disabled={u.id === currentUserId}
                    title={u.id === currentUserId ? "You cannot delete your own account" : undefined}
                    onClick={() => {
                      setError(null);
                      setDeleting(u);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={current ? `Edit ${current.name}` : "Add user"}>
        <form key={current?.id ?? "new"} onSubmit={save} className="space-y-3">
          <div>
            <label htmlFor="u-name" className="label">
              Name
            </label>
            <input id="u-name" name="name" required defaultValue={current?.name} className="input" />
          </div>
          <div>
            <label htmlFor="u-email" className="label">
              Email
            </label>
            <input id="u-email" name="email" type="email" required defaultValue={current?.email} className="input" />
          </div>
          <div>
            <label htmlFor="u-password" className="label">
              {current ? "New password (leave blank to keep)" : "Password"}
            </label>
            <input
              id="u-password"
              name="password"
              type="password"
              minLength={8}
              required={!current}
              autoComplete="new-password"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="u-role" className="label">
              Role
            </label>
            <select
              id="u-role"
              name="role"
              defaultValue={current?.role ?? "user"}
              disabled={current?.id === currentUserId}
              className="input"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {current ? "Save" : "Create user"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name} permanently?` : ""}
        message={
          <>
            This removes the user account, their notifications, and every task they created or took part in
            (assignments, messages, and activity on those tasks). This cannot be undone.
            {deleting && (
              <span className="mt-2 block font-medium text-slate-800">
                User: {deleting.email}
              </span>
            )}
          </>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      >
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.isActive ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        message={
          toggling?.isActive
            ? "They will be signed out and cannot be assigned new work. Their task history is kept."
            : "They will be able to sign in and receive assignments again."
        }
        confirmLabel={toggling?.isActive ? "Deactivate" : "Activate"}
        tone={toggling?.isActive ? "danger" : "primary"}
        busy={busy}
        onClose={() => setToggling(null)}
        onConfirm={toggle}
      >
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </ConfirmDialog>
    </>
  );
}

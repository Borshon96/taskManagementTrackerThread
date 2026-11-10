import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { requirePageAdmin } from "@/server/session";
import { listAllActivities } from "@/server/task-queries";
import { listAllUserNames } from "@/server/users";

export const metadata = { title: "Activity Log · Task Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requirePageAdmin();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const num = (k: string) => (Number(str(k)) > 0 ? Number(str(k)) : undefined);
  const type = (ACTIVITY_TYPES as readonly string[]).includes(str("type")) ? str("type") : undefined;
  const { rows, total, page, pageSize } = listAllActivities(admin, {
    page: num("page"),
    taskId: num("task"),
    userId: num("user"),
    type,
  });
  const users = listAllUserNames();

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const k of ["task", "user", "type"]) if (str(k)) qs.set(k, str(k));
    qs.set("page", String(p));
    return `/admin/activity?${qs}`;
  };

  return (
    <div>
      <PageHeader title="Activity Log" />
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label htmlFor="task" className="label">
            Task ID
          </label>
          <input id="task" name="task" inputMode="numeric" defaultValue={str("task")} className="input w-28" />
        </div>
        <div>
          <label htmlFor="user" className="label">
            User
          </label>
          <select id="user" name="user" defaultValue={str("user")} className="input">
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="label">
            Activity
          </label>
          <select id="type" name="type" defaultValue={type ?? ""} className="input">
            <option value="">Any</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABELS[t]} ({t})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
        <Link href="/admin/activity" className="btn-secondary">
          Reset
        </Link>
      </form>

      <div className="mb-2 text-xs text-slate-500">
        {total} record{total === 1 ? "" : "s"} · newest first
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Activity</th>
              <th className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{formatDateTime(r.createdAt)}</td>
                <td className="max-w-[200px] px-3 py-2">
                  <Link href={`/tasks/${r.taskId}`} className="block truncate hover:underline">
                    <span className="font-mono text-xs text-slate-400">#{r.taskId}</span> {r.taskTitle}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{r.userName}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{ACTIVITY_LABELS[r.activityType]}</span>
                </td>
                <td className="min-w-[320px] px-3 py-2 text-slate-700">{r.description}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                  No activity matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-500">
          {page > 1 && (
            <Link className="underline" href={pageHref(page - 1)}>
              Previous
            </Link>
          )}
          <span>
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total && (
            <Link className="underline" href={pageHref(page + 1)}>
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

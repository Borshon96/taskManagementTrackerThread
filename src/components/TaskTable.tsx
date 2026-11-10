import Link from "next/link";
import type { TaskPriority } from "@/lib/constants";
import { formatDate, formatDateTime, formatDueDate, formatRelative, todayInAppZone } from "@/lib/format";
import type { TaskRow } from "@/server/task-queries";
import { ClickableRow } from "./ClickableRow";
import { PriorityBadge, StatusBadge, UserChip } from "./ui";

export function TaskTable({ rows }: { rows: TaskRow[] }) {
  const today = todayInAppZone();
  if (rows.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-sm text-slate-500">
        No tasks match these filters.{" "}
        <Link href="/tasks/new" className="font-medium text-slate-900 underline">
          Create a task
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Created By</th>
            <th className="px-3 py-2">Current Assignee</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Last Activity</th>
            <th className="px-3 py-2">Due Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => {
            const overdue = t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "cancelled";
            return (
              <ClickableRow key={t.id} href={`/tasks/${t.id}`} className="hover:bg-slate-50">
                <td className="max-w-[360px] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-slate-400">#{t.id}</span>
                    <Link href={`/tasks/${t.id}`} className="truncate font-medium text-slate-900 hover:underline">
                      {t.title}
                    </Link>
                    {t.priority !== "normal" && <PriorityBadge priority={t.priority as TaskPriority} />}
                  </div>
                  {(t.myPendingAck > 0 || t.myOpenFollowUp > 0 || t.openFollowUps > 0) && (
                    <div className="mt-0.5 flex gap-2 text-xs">
                      {t.myPendingAck > 0 && <span className="font-medium text-blue-700">Needs your acknowledgement</span>}
                      {t.myOpenFollowUp > 0 && <span className="font-medium text-violet-700">Follow-up for you</span>}
                      {t.openFollowUps > 0 && t.myOpenFollowUp === 0 && (
                        <span className="text-slate-500">
                          {t.openFollowUps} open follow-up{t.openFollowUps === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                  <UserChip name={t.creatorName} id={t.createdBy} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                  <UserChip name={t.assigneeName} id={t.currentAssignee} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600" title={formatDateTime(t.createdAt)}>
                  {formatDate(t.createdAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600" title={formatDateTime(t.lastActivityAt)}>
                  {formatRelative(t.lastActivityAt)}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 ${overdue ? "font-medium text-red-600" : "text-slate-600"}`}>
                  {t.dueDate ? formatDueDate(t.dueDate) : <span className="text-slate-300">—</span>}
                  {overdue && <span className="ml-1 text-xs">overdue</span>}
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

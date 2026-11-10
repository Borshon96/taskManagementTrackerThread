import Link from "next/link";
import { TaskFilters } from "@/components/TaskFilters";
import { TaskTable } from "@/components/TaskTable";
import { parseTaskFilters } from "@/server/filters";
import { requirePageUser } from "@/server/session";
import { dashboardCounts, listTasks, type TaskView } from "@/server/task-queries";
import { listAllUserNames } from "@/server/users";

export const metadata = { title: "Dashboard · Task Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const filters = parseTaskFilters(params);
  const counts = dashboardCounts(user);
  const { rows, total, page, pageSize } = listTasks(user, filters);
  const isAdmin = user.role === "admin";

  const cards: { view: TaskView; label: string; value: number; hint: string }[] = [
    { view: "my_open", label: isAdmin ? "Open Tasks" : "My Open Tasks", value: counts.my_open, hint: isAdmin ? "Across the organization" : "Created by or assigned to you" },
    { view: "assigned", label: "Assigned to Me", value: counts.assigned, hint: "Open tasks and follow-ups" },
    { view: "created", label: "Created by Me", value: counts.created, hint: "All time" },
    { view: "pending_ack", label: "Pending Acknowledgement", value: counts.pending_ack, hint: isAdmin ? "Awaiting a Received response" : "Waiting for your response" },
    { view: "in_progress", label: "In Progress", value: counts.in_progress, hint: "Being worked on" },
    { view: "completed", label: "Completed", value: counts.completed, hint: "Closed with full history" },
  ];

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    qs.set("page", String(p));
    return `/?${qs}`;
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const selected = filters.view === c.view;
          return (
            <Link
              key={c.view}
              href={selected ? "/" : `/?view=${c.view}`}
              className={`card block p-3 transition-colors hover:border-slate-400 ${selected ? "border-slate-900 ring-1 ring-slate-900" : ""}`}
            >
              <div className="text-xs font-medium text-slate-500">{c.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-400">{c.hint}</div>
            </Link>
          );
        })}
      </div>

      <TaskFilters filters={filters} users={listAllUserNames()} isAdmin={isAdmin} />

      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {total} task{total === 1 ? "" : "s"}
        </span>
        {total > pageSize && (
          <span className="flex items-center gap-2">
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
          </span>
        )}
      </div>
      <TaskTable rows={rows} />
    </>
  );
}

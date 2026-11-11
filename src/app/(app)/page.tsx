import Link from "next/link";
import { TaskFilters } from "@/components/TaskFilters";
import { TaskTable } from "@/components/TaskTable";
import { listChannelMembers, listChannels } from "@/server/channels";
import { parseTaskFilters } from "@/server/filters";
import { requirePageUser } from "@/server/session";
import { dashboardCounts, listTasks, type TaskView } from "@/server/task-queries";
import { listAllUserNames } from "@/server/users";

export const metadata = { title: "Dashboard · Task Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser();
  const rawParams = await searchParams;
  const filters = parseTaskFilters(rawParams);
  const counts = dashboardCounts(user);
  const channels = listChannels(user);
  const isAdmin = user.role === "admin";
  const basePath = "/";

  const splitOpenClosed =
    filters.view === "all" &&
    !filters.status &&
    !filters.q &&
    !filters.assigneeId &&
    !filters.creatorId &&
    !filters.from &&
    !filters.to;

  const openList = splitOpenClosed ? listTasks(user, { ...filters, status: "open" }) : null;
  const closedList = splitOpenClosed ? listTasks(user, { ...filters, status: "closed", page: 1 }) : null;
  const combined = splitOpenClosed ? null : listTasks(user, filters);
  const rows = combined?.rows ?? [];
  const total = splitOpenClosed ? openList!.total + closedList!.total : combined!.total;
  const page = combined?.page ?? filters.page ?? 1;
  const pageSize = combined?.pageSize ?? 50;

  const memberIds = new Set<number>([user.id]);
  for (const ch of channels) {
    for (const m of listChannelMembers(user, ch.id)) memberIds.add(m.userId);
  }
  const filterUsers = listAllUserNames().filter((u) => memberIds.has(u.id));

  const cards: { view: TaskView; label: string; value: number; hint: string }[] = [
    {
      view: "my_open",
      label: isAdmin ? "Open Tasks" : "My Open Tasks",
      value: counts.my_open,
      hint: isAdmin ? "All projects" : "Created by or assigned to you",
    },
    { view: "assigned", label: "Assigned to Me", value: counts.assigned, hint: "Open tasks and follow-ups" },
    { view: "created", label: "Created by Me", value: counts.created, hint: "All projects" },
    {
      view: "pending_ack",
      label: "Pending Acknowledgement",
      value: counts.pending_ack,
      hint: isAdmin ? "Awaiting a Received response" : "Waiting for your response",
    },
    {
      view: "awaiting",
      label: "Awaiting Anyone",
      value: counts.awaiting,
      hint: "Open tasks waiting for someone to mark Received",
    },
    { view: "in_progress", label: "In Progress", value: counts.in_progress, hint: "Being worked on" },
    { view: "completed", label: "Completed", value: counts.completed, hint: "Closed with full history" },
  ];

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    qs.set("page", String(p));
    const q = qs.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Welcome back, {user.name}. Work across all projects you belong to.
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary">
          <span aria-hidden>+</span> New task
        </Link>
      </div>

      {channels.length > 0 && (
        <section className="mb-5" aria-label="Your projects">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</h2>
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => (
              <Link
                key={c.id}
                href={`/channels/${c.id}`}
                className="card inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:border-slate-400"
              >
                <span className="font-medium text-slate-900">{c.name}</span>
                <span className="tabular-nums text-slate-500">{c.taskCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const selected = filters.view === c.view;
          return (
            <Link
              key={c.view}
              href={selected ? basePath : `${basePath}?view=${c.view}`}
              className={`card block p-3 transition-colors hover:border-slate-400 ${selected ? "border-slate-900 ring-1 ring-slate-900" : ""}`}
            >
              <div className="text-xs font-medium text-slate-500">{c.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-400">{c.hint}</div>
            </Link>
          );
        })}
      </div>

      <TaskFilters filters={filters} users={filterUsers} isAdmin={isAdmin} basePath={basePath} />

      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {splitOpenClosed ? (
            <>
              {openList!.total} open · {closedList!.total} closed ({total} total)
            </>
          ) : (
            <>
              {total} task{total === 1 ? "" : "s"} across your projects
            </>
          )}
        </span>
        {!splitOpenClosed && total > pageSize && (
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
        {splitOpenClosed && openList!.total > openList!.pageSize && (
          <span className="flex items-center gap-2">
            {openList!.page > 1 && (
              <Link className="underline" href={pageHref(openList!.page - 1)}>
                Previous open
              </Link>
            )}
            {openList!.page * openList!.pageSize < openList!.total && (
              <Link className="underline" href={pageHref(openList!.page + 1)}>
                More open tasks
              </Link>
            )}
          </span>
        )}
      </div>

      {splitOpenClosed ? (
        <div className="space-y-8">
          <TaskTable
            rows={openList!.rows}
            heading="Open tasks"
            emptyMessage="No open tasks in your projects."
          />
          <TaskTable rows={closedList!.rows} heading="Closed tasks" muted />
        </div>
      ) : (
        <TaskTable rows={rows} emptyMessage="No tasks match these filters." />
      )}
    </>
  );
}

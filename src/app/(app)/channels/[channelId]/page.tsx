import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskFilters } from "@/components/TaskFilters";
import { TaskTable } from "@/components/TaskTable";
import { AppError } from "@/lib/errors";
import { ChannelMembers } from "@/components/ChannelMembers";
import { getChannel, listChannelMembers, listInvitableUsers } from "@/server/channels";
import { parseTaskFilters } from "@/server/filters";
import { requirePageUser } from "@/server/session";
import { dashboardCounts, listTasks, type TaskView } from "@/server/task-queries";
import { listAllUserNames } from "@/server/users";

type Params = Promise<{ channelId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const id = Number((await params).channelId);
  return { title: Number.isInteger(id) ? `Project · Task Tracker` : "Task Tracker" };
}

export default async function ChannelDashboardPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requirePageUser();
  const channelId = Number((await params).channelId);
  if (!Number.isInteger(channelId) || channelId <= 0) notFound();

  let channel;
  try {
    channel = getChannel(user, channelId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const rawParams = await searchParams;
  const filters = { ...parseTaskFilters(rawParams), channelId };
  const counts = dashboardCounts(user, channelId);
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
  const total = splitOpenClosed ? (openList!.total + closedList!.total) : combined!.total;
  const page = combined?.page ?? filters.page ?? 1;
  const pageSize = combined?.pageSize ?? 50;
  const isAdmin = user.role === "admin";
  const basePath = `/channels/${channelId}`;
  const members = listChannelMembers(user, channelId);
  const invitees = listInvitableUsers(user, channelId);
  const memberIds = new Set(members.map((m) => m.userId));
  const filterUsers = listAllUserNames().filter((u) => memberIds.has(u.id));

  const cards: { view: TaskView; label: string; value: number; hint: string }[] = [
    { view: "my_open", label: isAdmin ? "Open Tasks" : "My Open Tasks", value: counts.my_open, hint: isAdmin ? "In this project" : "Created by or assigned to you" },
    { view: "assigned", label: "Assigned to Me", value: counts.assigned, hint: "Open tasks and follow-ups" },
    { view: "created", label: "Created by Me", value: counts.created, hint: "All time in this project" },
    { view: "pending_ack", label: "Pending Acknowledgement", value: counts.pending_ack, hint: isAdmin ? "Awaiting a Received response" : "Waiting for your response" },
    { view: "awaiting", label: "Awaiting Anyone", value: counts.awaiting, hint: "Open tasks waiting for someone to mark Received" },
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
          <h1 className="text-lg font-semibold">{channel.name}</h1>
          {channel.description ? <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{channel.description}</p> : null}
        </div>
        <Link href={`/tasks/new?channel=${channelId}`} className="btn-primary">
          <span aria-hidden>+</span> New task
        </Link>
      </div>

      <ChannelMembers channelId={channelId} members={members} invitees={invitees} currentUserId={user.id} />

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
              {total} task{total === 1 ? "" : "s"} in this project
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
            channelId={channelId}
            heading="Open tasks"
            emptyMessage="No open tasks in this project."
          />
          <TaskTable rows={closedList!.rows} channelId={channelId} heading="Closed tasks" muted />
        </div>
      ) : (
        <TaskTable rows={rows} channelId={channelId} />
      )}
    </>
  );
}

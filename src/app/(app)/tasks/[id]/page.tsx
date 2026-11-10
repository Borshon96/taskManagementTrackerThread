import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AssignmentChain } from "@/components/AssignmentChain";
import { Avatar, PriorityBadge, StatusBadge, UserChip } from "@/components/ui";
import { AppError } from "@/lib/errors";
import { formatDateTime, formatDueDate } from "@/lib/format";
import { requirePageUser } from "@/server/session";
import { getTaskDetail, type TaskDetail } from "@/server/task-queries";
import { listActiveUsers } from "@/server/users";
import { Composer } from "./Composer";
import { TaskActions } from "./TaskActions";

type Params = Promise<{ id: string }>;

function load(user: Awaited<ReturnType<typeof requirePageUser>>, id: string): TaskDetail {
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId <= 0) notFound();
  try {
    return getTaskDetail(user, taskId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  return { title: `Task #${(await params).id} · Task Tracker` };
}

export default async function TaskPage({ params }: { params: Params }) {
  const user = await requirePageUser();
  const detail = load(user, (await params).id);
  const { task, primary, permissions } = detail;
  const others = listActiveUsers()
    .filter((u) => u.id !== user.id)
    .map((u) => ({ id: u.id, name: u.name }));
  const locked = task.status === "completed" || task.status === "cancelled";

  return (
    <div>
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to tasks
      </Link>

      <header className="card mt-2 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-slate-400">#{task.id}</span>
              <StatusBadge status={task.status} />
              {task.priority !== "normal" && <PriorityBadge priority={task.priority} />}
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{task.title}</h1>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Meta label="Created by">
            <UserChip name={detail.creatorName} id={task.createdBy} />
          </Meta>
          <Meta label="Created">{formatDateTime(task.createdAt)}</Meta>
          <Meta label="Current assignee">
            <UserChip name={detail.assigneeName} id={task.currentAssignee} />
          </Meta>
          <Meta label="Assigned">{primary ? formatDateTime(primary.assignedAt) : "—"}</Meta>
          <Meta label="Received">
            {primary?.receivedAt ? (
              formatDateTime(primary.receivedAt)
            ) : primary ? (
              <span className="text-amber-700">{primary.status === "not_received" ? "Marked Not Received" : "Awaiting"}</span>
            ) : (
              "—"
            )}
          </Meta>
          <Meta label={task.completedAt ? "Completed" : "Due date"}>
            {task.completedAt ? (
              <span className="text-emerald-700">
                {formatDateTime(task.completedAt)}
                {detail.completedByName && <span className="block text-xs text-slate-500">by {detail.completedByName}</span>}
              </span>
            ) : task.dueDate ? (
              formatDueDate(task.dueDate)
            ) : (
              "—"
            )}
          </Meta>
        </dl>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Description</h2>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
            ) : (
              <p className="text-sm text-slate-400">No description.</p>
            )}
          </section>

          <section className="card p-4" aria-label="Activity and thread">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Activity &amp; thread</h2>
              <span className="text-xs text-slate-500">{detail.activities.length} events · oldest first</span>
            </div>
            <ActivityTimeline activities={detail.activities} />
            <div className="mt-4">
              {locked ? (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                    <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" />
                  </svg>
                  This task is {task.status}. Its history is locked and kept permanently.
                </div>
              ) : (
                permissions.canMessage && (
                  <Composer
                    taskId={task.id}
                    participants={detail.participants}
                    users={others}
                    canFollowUp={permissions.canFollowUp}
                  />
                )
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <TaskActions
            taskId={task.id}
            task={{
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
              currentAssignee: task.currentAssignee,
            }}
            statusOptions={permissions.statusOptions}
            canAssign={permissions.canAssign}
            canEdit={permissions.canEdit}
            openFollowUps={detail.openFollowUps}
            myAcknowledgements={detail.myAcknowledgements}
            myFollowUps={detail.myFollowUps}
            assignees={others}
          />

          <section className="card p-4" aria-label="Assignment chain">
            <h2 className="mb-3 text-sm font-semibold">Assignment chain</h2>
            <AssignmentChain
              creator={{ id: task.createdBy, name: detail.creatorName }}
              createdAt={task.createdAt}
              assignments={detail.assignments}
            />
            {task.completedAt && (
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm">
                <Avatar name={detail.completedByName} id={task.completedBy} size="md" />
                <div>
                  <div className="font-medium text-emerald-700">Task completed</div>
                  <div className="text-xs text-slate-500">
                    {detail.completedByName} · {formatDateTime(task.completedAt)}
                  </div>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { buildAssignmentThreadActions } from "@/lib/assignment-thread";
import { AssignmentChain } from "@/components/AssignmentChain";
import { AssigneeListInline } from "@/components/AssigneeList";
import { Avatar } from "@/components/ui";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { listChannelMemberIds } from "@/server/channels";
import { requirePageUser } from "@/server/session";
import { getTaskDetail, type TaskDetail } from "@/server/task-queries";
import { getDb } from "@/db";
import { listActiveUsers } from "@/server/users";
import { TaskThread } from "./TaskThread";
import { ReopenTask } from "./ReopenTask";
import { TaskActions } from "./TaskActions";
import { SyncTaskChannel } from "@/components/ActiveChannelContext";
import { parseNotificationMark, parseTaskFocus } from "@/lib/notification-link";
import {
  markRead,
  markReadByFocus,
  markReadByFocusLoose,
  markReadLatestForTask,
  markReadLatestUnread,
} from "@/server/notifications";
import { TaskHeader } from "./TaskHeader";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

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
  const user = await requirePageUser();
  const id = (await params).id;
  try {
    const { task, channel } = getTaskDetail(user, Number(id));
    return { title: `${task.title} · ${channel.name}` };
  } catch {
    return { title: `Task #${id} · Task Tracker` };
  }
}

export default async function TaskPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requirePageUser();
  const rawSearch = await searchParams;
  const focusTarget = parseTaskFocus(rawSearch.focus);
  const highlightFromNotification = rawSearch.from === "notification";
  const taskId = Number((await params).id);
  const notificationMarkId = parseNotificationMark(rawSearch.notificationId);
  if (notificationMarkId) {
    markRead(user, notificationMarkId);
  } else if (rawSearch.from === "notification") {
    if (focusTarget) {
      const marked =
        markReadByFocus(user, taskId, focusTarget) ||
        markReadByFocusLoose(user, focusTarget) ||
        markReadLatestForTask(user, taskId);
      if (!marked) markReadLatestUnread(user);
    } else {
      markReadLatestForTask(user, taskId) || markReadLatestUnread(user);
    }
  }
  const detail = load(user, (await params).id);
  const { task, channel, primary, permissions } = detail;
  const memberIds = new Set(listChannelMemberIds(getDb(), task.channelId));
  const others = listActiveUsers()
    .filter((u) => u.id !== user.id && memberIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name }));
  const locked = task.status === "completed" || task.status === "cancelled";
  const needsAttention =
    detail.myAcknowledgements.length > 0 || detail.myFollowUps.length > 0 || permissions.statusOptions.length > 0;

  const taskActionsProps = {
    taskId: task.id,
    task: {
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      currentAssignee: task.currentAssignee,
    },
    statusOptions: permissions.statusOptions,
    canAssign: permissions.canAssign,
    canEdit: permissions.canEdit,
    openFollowUps: detail.openFollowUps,
    myAcknowledgements: detail.myAcknowledgements,
    myFollowUps: detail.myFollowUps,
    assignees: others,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col pb-4">
      <SyncTaskChannel channelId={channel.id} />
      <div className="space-y-3">
        <Link href={`/channels/${channel.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to {channel.name}
        </Link>

        <TaskHeader
        channelId={channel.id}
        channelName={channel.name}
        taskId={task.id}
        title={task.title}
        description={task.description}
        status={task.status}
        priority={task.priority}
        dueDate={task.dueDate}
        completedAt={task.completedAt}
        createdBy={task.createdBy}
        creatorName={detail.creatorName}
        canEdit={permissions.canEdit}
        locked={locked}
        activeAssignees={detail.activeAssignees}
        assigneeName={detail.assigneeName}
        taskMembers={detail.taskMembers}
        taskMemberInvitees={detail.taskMemberInvitees}
        canManageMembers={permissions.canManageMembers}
        reopenedFrom={detail.reopenedFrom}
        continuedAs={detail.continuedAs}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_min(280px,28vw)] lg:items-start lg:gap-4">
        <section className="card flex min-w-0 flex-col overflow-hidden p-3 sm:p-4" aria-label="Activity and thread">
          <TaskThread
            taskId={task.id}
            activities={detail.activities}
            assignmentActions={buildAssignmentThreadActions(detail)}
            participants={detail.participants}
            users={others}
            canFollowUp={permissions.canFollowUp}
            canMessage={permissions.canMessage}
            locked={locked}
            currentUserId={user.id}
            focusTarget={focusTarget}
            highlightFromNotification={highlightFromNotification}
            assignments={detail.assignments.map((a) => ({ id: a.id, status: a.status }))}
            myPendingAssignmentIds={detail.myAcknowledgements.map((a) => a.id)}
          />
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <details className="card group lg:hidden" open={needsAttention}>
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                Actions
                {needsAttention && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">Needs you</span>
                )}
              </span>
            </summary>
            <div className="border-t border-slate-100 px-3 pb-3 pt-1">
              {permissions.canReopen && <ReopenTask taskId={task.id} />}
              <TaskActions {...taskActionsProps} />
            </div>
          </details>

          <details className="card lg:hidden">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
              Details &amp; assignments
            </summary>
            <div className="border-t border-slate-100 px-3 pb-3 pt-2 text-sm">
              <TaskDetailsBody detail={detail} task={task} primary={primary} />
              <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment chain</h3>
              <AssignmentChain
                creator={{ id: task.createdBy, name: detail.creatorName }}
                createdAt={task.createdAt}
                assignments={detail.assignments}
              />
            </div>
          </details>

          <div className="hidden space-y-3 lg:block">
            {permissions.canReopen && <ReopenTask taskId={task.id} />}
            <TaskActions {...taskActionsProps} />
            <section className="card p-3" aria-label="Assignment chain">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Details</h2>
              <TaskDetailsBody detail={detail} task={task} primary={primary} compact />
              <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignments</h3>
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
          </div>
        </aside>
      </div>
    </div>
  );
}

function TaskDetailsBody({
  detail,
  task,
  primary,
  compact,
}: {
  detail: TaskDetail;
  task: TaskDetail["task"];
  primary: TaskDetail["primary"];
  compact?: boolean;
}) {
  return (
    <dl className={`grid gap-2 text-sm ${compact ? "gap-1.5 text-xs" : "grid-cols-2"}`}>
      <div>
        <dt className="text-slate-500">Created</dt>
        <dd className="text-slate-800">{formatDateTime(task.createdAt)}</dd>
      </div>
      {primary && (
        <div>
          <dt className="text-slate-500">Assigned</dt>
          <dd className="text-slate-800">{formatDateTime(primary.assignedAt)}</dd>
        </div>
      )}
      {primary && (
        <div>
          <dt className="text-slate-500">Main received</dt>
          <dd className="text-slate-800">
            {primary.receivedAt ? (
              formatDateTime(primary.receivedAt)
            ) : primary.status === "not_received" ? (
              <span className="text-rose-700">Not received</span>
            ) : (
              <span className="text-amber-700">Awaiting</span>
            )}
          </dd>
        </div>
      )}
      {!compact && detail.activeAssignees.length > 1 && (
        <div className="col-span-2">
          <dt className="text-slate-500">Everyone on this task</dt>
          <dd className="mt-0.5">
            <AssigneeListInline assignees={detail.activeAssignees} fallbackName={detail.assigneeName} />
          </dd>
        </div>
      )}
    </dl>
  );
}

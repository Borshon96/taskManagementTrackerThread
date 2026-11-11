import { dedupeActiveAssignees } from "@/lib/assignees";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  channels,
  LISTED_ASSIGNMENT_STATUSES,
  OPEN_ASSIGNMENT_STATUSES,
  TASK_STATUSES,
  taskActivities,
  taskAssignments,
  taskMessages,
  tasks,
  users,
  type ActivityType,
  type TaskAssignment,
  type TaskStatus,
} from "@/db/schema";
import { zonedDayStartIso } from "@/lib/format";
import type { SessionUser } from "./auth";
import { listChannelMemberIds } from "./channels";
import { listInvitableTaskUsers, listTaskMemberViews } from "./task-members";
import { readAttachmentsForMessages, type AttachmentView } from "./attachments";
import { involvedUserIds, isManager, isTerminal, loadVisibleTask } from "./task-core";
import { allowedStatusTransitions } from "./tasks";

export const TASK_VIEWS = [
  "all",
  "my_open",
  "assigned",
  "created",
  "pending_ack",
  "awaiting",
  "in_progress",
  "completed",
  "mine",
] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export type TaskFilters = {
  channelId?: number;
  q?: string;
  status?: string;
  assigneeId?: number;
  creatorId?: number;
  from?: string;
  to?: string;
  view?: TaskView;
  page?: number;
};

export type TaskRow = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  createdBy: number;
  creatorName: string;
  currentAssignee: number | null;
  assigneeName: string | null;
  lastActivityAt: string;
  myPendingAck: number;
  myOpenFollowUp: number;
  openFollowUps: number;
  activeAssigneeIds: string | null;
  activeAssigneeNames: string | null;
  awaitingIds: string | null;
  awaitingNames: string | null;
};

export type ActiveAssigneeView = {
  assignmentId: number;
  userId: number;
  name: string;
  assignmentType: "primary" | "follow_up";
  status: string;
};

const PAGE_SIZE = 50;
const OPEN = sql`t.status NOT IN ('completed', 'cancelled')`;

function channelMember(me: number) {
  return sql`EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = t.channel_id AND cm.user_id = ${me})`;
}

function taskMember(me: number) {
  return sql`EXISTS (SELECT 1 FROM task_members tm WHERE tm.task_id = t.id AND tm.user_id = ${me})`;
}

function openFollowUpFor(me: number) {
  return sql`EXISTS (SELECT 1 FROM task_assignments fa WHERE fa.task_id = t.id AND fa.assignment_type = 'follow_up'
    AND fa.assigned_to = ${me} AND fa.status IN ('pending', 'received', 'not_received', 'in_progress'))`;
}

function pendingAck(me: number | null) {
  const who = me === null ? sql`` : sql`AND pa.assigned_to = ${me}`;
  return sql`EXISTS (SELECT 1 FROM task_assignments pa WHERE pa.task_id = t.id ${who} AND pa.status IN ('pending', 'not_received'))`;
}

function viewCondition(view: TaskView, actor: SessionUser): SQL | null {
  const me = actor.id;
  const admin = actor.role === "admin";
  const mine = sql`(t.created_by = ${me} OR t.current_assignee = ${me} OR ${openFollowUpFor(me)})`;
  switch (view) {
    case "my_open":
      return admin ? OPEN : sql`${OPEN} AND ${mine}`;
    case "assigned":
      return sql`${OPEN} AND (t.current_assignee = ${me} OR ${openFollowUpFor(me)})`;
    case "created":
      return sql`t.created_by = ${me}`;
    case "pending_ack":
      return sql`${OPEN} AND ${pendingAck(admin ? null : me)}`;
    case "awaiting":
      return sql`${OPEN} AND EXISTS (SELECT 1 FROM task_assignments pa WHERE pa.task_id = t.id AND pa.status IN ('pending', 'not_received'))`;
    case "in_progress":
      return sql`t.status = 'in_progress'`;
    case "completed":
      return sql`t.status = 'completed'`;
    case "mine":
      return mine;
    default:
      return null;
  }
}

function baseConditions(actor: SessionUser) {
  const conditions = [channelMember(actor.id)];
  if (actor.role !== "admin") conditions.push(taskMember(actor.id));
  return conditions;
}

function where(conditions: SQL[]) {
  return conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
}

export function listTasks(actor: SessionUser, filters: TaskFilters = {}) {
  const db = getDb();
  const conditions = baseConditions(actor);
  if (filters.channelId) {
    conditions.push(sql`t.channel_id = ${filters.channelId}`);
  }
  const view = viewCondition(filters.view ?? "all", actor);
  if (view) conditions.push(view);

  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const asId = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
    conditions.push(
      asId !== null
        ? sql`(t.id = ${asId} OR t.title LIKE ${like} ESCAPE '\\')`
        : sql`t.title LIKE ${like} ESCAPE '\\'`,
    );
  }
  if (filters.status && (TASK_STATUSES as readonly string[]).includes(filters.status)) {
    conditions.push(sql`t.status = ${filters.status}`);
  } else if (filters.status === "open") {
    conditions.push(OPEN);
  } else if (filters.status === "closed") {
    conditions.push(sql`t.status IN ('completed', 'cancelled')`);
  }
  if (filters.assigneeId) conditions.push(sql`t.current_assignee = ${filters.assigneeId}`);
  if (filters.creatorId) conditions.push(sql`t.created_by = ${filters.creatorId}`);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    conditions.push(sql`t.created_at >= ${zonedDayStartIso(filters.from)}`);
  }
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    const next = new Date(`${filters.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    conditions.push(sql`t.created_at < ${zonedDayStartIso(next.toISOString().slice(0, 10))}`);
  }

  const page = Math.max(1, filters.page ?? 1);
  const whereSql = where(conditions);
  const total = db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM tasks t ${whereSql}`)?.n ?? 0;
  const rows = db.all<TaskRow>(sql`
    SELECT
      t.id, t.title, t.status, t.priority, t.due_date AS dueDate, t.created_at AS createdAt,
      t.created_by AS createdBy, cu.name AS creatorName,
      t.current_assignee AS currentAssignee, au.name AS assigneeName,
      COALESCE((SELECT MAX(ta.created_at) FROM task_activities ta WHERE ta.task_id = t.id), t.updated_at) AS lastActivityAt,
      ${openFlag(pendingAck(actor.id))} AS myPendingAck,
      ${openFlag(openFollowUpFor(actor.id))} AS myOpenFollowUp,
      (SELECT COUNT(*) FROM task_assignments oa WHERE oa.task_id = t.id AND oa.assignment_type = 'follow_up'
        AND oa.status IN ('pending', 'received', 'not_received', 'in_progress')) AS openFollowUps,
      (SELECT GROUP_CONCAT(x.assigned_to)
        FROM (
          SELECT ta.assigned_to,
                 MIN(CASE ta.assignment_type WHEN 'primary' THEN 0 ELSE 1 END) AS type_rank,
                 MIN(ta.id) AS first_id
          FROM task_assignments ta
          WHERE ta.task_id = t.id
            AND ta.status IN ('pending', 'received', 'not_received', 'in_progress', 'completed')
          GROUP BY ta.assigned_to
          ORDER BY type_rank, first_id
        ) x) AS activeAssigneeIds,
      (SELECT GROUP_CONCAT(u.name, ', ')
        FROM (
          SELECT ta.assigned_to,
                 MIN(CASE ta.assignment_type WHEN 'primary' THEN 0 ELSE 1 END) AS type_rank,
                 MIN(ta.id) AS first_id
          FROM task_assignments ta
          WHERE ta.task_id = t.id
            AND ta.status IN ('pending', 'received', 'not_received', 'in_progress', 'completed')
          GROUP BY ta.assigned_to
          ORDER BY type_rank, first_id
        ) x
        JOIN users u ON u.id = x.assigned_to) AS activeAssigneeNames,
      (SELECT GROUP_CONCAT(p.assigned_to)
        FROM (
          SELECT ta.assigned_to,
                 MIN(CASE ta.assignment_type WHEN 'primary' THEN 0 ELSE 1 END) AS type_rank,
                 MIN(ta.id) AS first_id
          FROM task_assignments ta
          WHERE ta.task_id = t.id AND ta.status IN ('pending', 'not_received')
          GROUP BY ta.assigned_to
          ORDER BY type_rank, first_id
        ) p) AS awaitingIds,
      (SELECT GROUP_CONCAT(u.name, ', ')
        FROM (
          SELECT ta.assigned_to,
                 MIN(CASE ta.assignment_type WHEN 'primary' THEN 0 ELSE 1 END) AS type_rank,
                 MIN(ta.id) AS first_id
          FROM task_assignments ta
          WHERE ta.task_id = t.id AND ta.status IN ('pending', 'not_received')
          GROUP BY ta.assigned_to
          ORDER BY type_rank, first_id
        ) p
        JOIN users u ON u.id = p.assigned_to) AS awaitingNames
    FROM tasks t
    JOIN users cu ON cu.id = t.created_by
    LEFT JOIN users au ON au.id = t.current_assignee
    ${whereSql}
    ORDER BY lastActivityAt DESC, t.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

function openFlag(cond: SQL) {
  return sql`CASE WHEN ${OPEN} AND ${cond} THEN 1 ELSE 0 END`;
}

export const DASHBOARD_CARDS = ["my_open", "assigned", "created", "pending_ack", "awaiting", "in_progress", "completed"] as const;

export function dashboardCounts(actor: SessionUser, channelId?: number) {
  const db = getDb();
  const counts = {} as Record<(typeof DASHBOARD_CARDS)[number], number>;
  for (const view of DASHBOARD_CARDS) {
    const conditions = [...baseConditions(actor), viewCondition(view, actor)!];
    if (channelId) conditions.push(sql`t.channel_id = ${channelId}`);
    counts[view] = db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM tasks t ${where(conditions)}`)?.n ?? 0;
  }
  return counts;
}

export type AssignmentView = TaskAssignment & { assignedByName: string; assignedToName: string };
export type ActivityView = {
  id: number;
  activityType: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  userId: number;
  userName: string;
  message: {
    id: number;
    body: string;
    recipientName: string | null;
    assignmentId: number | null;
    parentMessageId: number | null;
    parentActivityId: number | null;
    inReplyToMessageId: number | null;
    inReplyToActivityId: number | null;
    inReplyToPreview: string | null;
    inReplyToAuthorName: string | null;
    attachments: AttachmentView[];
  } | null;
};

export function getTaskDetail(actor: SessionUser, taskId: number) {
  const db = getDb();
  const task = loadVisibleTask(db, actor, taskId);
  const channel = db.select({ id: channels.id, name: channels.name }).from(channels).where(eq(channels.id, task.channelId)).get();
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  const nameOf = (id: number | null) => (id ? (names.get(id) ?? `User #${id}`) : null);

  const assignments: AssignmentView[] = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.taskId, task.id))
    .orderBy(asc(taskAssignments.assignedAt), asc(taskAssignments.id))
    .all()
    .map((a) => ({ ...a, assignedByName: nameOf(a.assignedBy)!, assignedToName: nameOf(a.assignedTo)! }));

  const messageRows = db.select().from(taskMessages).where(eq(taskMessages.taskId, task.id)).all();
  const messages = new Map(messageRows.map((m) => [m.id, m]));
  const attachmentsByMessage = readAttachmentsForMessages(
    db,
    messageRows.map((m) => m.id),
  );

  const activityRows = db
    .select()
    .from(taskActivities)
    .where(eq(taskActivities.taskId, task.id))
    .orderBy(asc(taskActivities.createdAt), asc(taskActivities.id))
    .all();
  const activityById = new Map(activityRows.map((a) => [a.id, a]));

  const activities: ActivityView[] = activityRows.map((a) => {
    const messageId = typeof a.metadata?.messageId === "number" ? a.metadata.messageId : null;
    const msg = messageId ? messages.get(messageId) : undefined;
    let inReplyToAuthorName: string | null = null;
    let inReplyToPreview: string | null = null;
    if (msg?.inReplyToMessageId) {
      const ref = messages.get(msg.inReplyToMessageId);
      inReplyToAuthorName = nameOf(ref?.senderId ?? null);
      inReplyToPreview = ref?.message ? ref.message.slice(0, 120) : null;
    } else if (msg?.inReplyToActivityId) {
      const ref = activityById.get(msg.inReplyToActivityId);
      inReplyToAuthorName = ref ? nameOf(ref.userId)! : null;
      inReplyToPreview = ref?.description.slice(0, 120) ?? null;
    }
    return {
      id: a.id,
      activityType: a.activityType,
      description: a.description,
      metadata: a.metadata ?? {},
      createdAt: a.createdAt,
      userId: a.userId,
      userName: nameOf(a.userId)!,
      message: msg
        ? {
            id: msg.id,
            body: msg.message,
            recipientName: nameOf(msg.recipientId),
            assignmentId: msg.assignmentId,
            parentMessageId: msg.parentMessageId ?? null,
            parentActivityId: msg.parentActivityId ?? null,
            inReplyToMessageId: msg.inReplyToMessageId ?? null,
            inReplyToActivityId: msg.inReplyToActivityId ?? null,
            inReplyToAuthorName,
            inReplyToPreview,
            attachments: attachmentsByMessage.get(msg.id) ?? [],
          }
        : null,
    };
  });

  const terminal = isTerminal(task);
  const reopenedFrom = task.reopenedFromTaskId
    ? db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, task.reopenedFromTaskId))
        .get() ?? null
    : null;
  const continuedAs =
    db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.reopenedFromTaskId, task.id))
      .orderBy(desc(tasks.id))
      .limit(1)
      .get() ?? null;
  const manager = isManager(actor, task);
  const openFollowUps = assignments.filter(
    (a) => a.assignmentType === "follow_up" && OPEN_ASSIGNMENT_STATUSES.includes(a.status),
  );
  const activeAssignees: ActiveAssigneeView[] = dedupeActiveAssignees(
    assignments
      .filter((a) => LISTED_ASSIGNMENT_STATUSES.includes(a.status))
      .sort((a, b) => {
        if (a.assignmentType !== b.assignmentType) return a.assignmentType === "primary" ? -1 : 1;
        return a.assignedAt.localeCompare(b.assignedAt) || a.id - b.id;
      })
      .map((a) => ({
        assignmentId: a.id,
        userId: a.assignedTo,
        name: a.assignedToName,
        assignmentType: a.assignmentType,
        status: a.status,
      })),
  );
  const primary = [...assignments].reverse().find((a) => a.assignmentType === "primary") ?? null;
  const activeIds = new Set(
    db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).all().map((u) => u.id),
  );
  const memberIds = new Set(listChannelMemberIds(db, task.channelId));
  const taskRosterIds = involvedUserIds(db, task);
  const participants = taskRosterIds
    .filter((id) => id !== actor.id && activeIds.has(id) && memberIds.has(id))
    .map((id) => ({ id, name: nameOf(id)! }))
    .sort((x, y) => x.name.localeCompare(y.name));
  const isAdmin = actor.role === "admin";
  const canManageMembers = isAdmin || (!terminal && task.createdBy === actor.id);
  const taskMembers = listTaskMemberViews(db, task.id);
  const taskMemberInvitees = canManageMembers ? listInvitableTaskUsers(actor, task.id) : [];

  return {
    participants,
    taskMembers,
    taskMemberInvitees,
    task,
    channel: channel ?? { id: task.channelId, name: "Project" },
    creatorName: nameOf(task.createdBy)!,
    assigneeName: nameOf(task.currentAssignee),
    completedByName: nameOf(task.completedBy),
    primary,
    activeAssignees,
    assignments,
    activities,
    openFollowUps: openFollowUps.length,
    reopenedFrom,
    continuedAs,
    permissions: {
      canEdit: isAdmin || (!terminal && task.createdBy === actor.id),
      canAssign: isAdmin || (!terminal && manager),
      canFollowUp: isAdmin || (!terminal && manager),
      canMessage: !terminal,
      canReopen: terminal && (actor.role === "admin" || task.createdBy === actor.id),
      canManageMembers,
      statusOptions:
        !terminal && manager
          ? allowedStatusTransitions(task.status).filter(
              (s) =>
                (s !== "completed" && s !== "cancelled") ||
                actor.role === "admin" ||
                task.createdBy === actor.id,
            )
          : [],
    },
    myAcknowledgements: terminal
      ? []
      : assignments.filter((a) => a.assignedTo === actor.id && (a.status === "pending" || a.status === "not_received")),
    myFollowUps: terminal
      ? []
      : assignments.filter(
          (a) => a.assignmentType === "follow_up" && a.assignedTo === actor.id && (a.status === "received" || a.status === "in_progress"),
        ),
  };
}

export type TaskDetail = ReturnType<typeof getTaskDetail>;

export function listAllActivities(
  actor: SessionUser,
  filters: { page?: number; taskId?: number; userId?: number; type?: string } = {},
) {
  if (actor.role !== "admin") return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.taskId) conditions.push(eq(taskActivities.taskId, filters.taskId));
  if (filters.userId) conditions.push(eq(taskActivities.userId, filters.userId));
  if (filters.type) conditions.push(eq(taskActivities.activityType, filters.type as ActivityType));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, filters.page ?? 1);
  const total = db.select({ n: sql<number>`count(*)` }).from(taskActivities).where(whereClause).get()?.n ?? 0;
  const rows = db
    .select({
      id: taskActivities.id,
      taskId: taskActivities.taskId,
      taskTitle: tasks.title,
      userName: users.name,
      activityType: taskActivities.activityType,
      description: taskActivities.description,
      createdAt: taskActivities.createdAt,
    })
    .from(taskActivities)
    .innerJoin(tasks, eq(tasks.id, taskActivities.taskId))
    .innerJoin(users, eq(users.id, taskActivities.userId))
    .where(whereClause)
    .orderBy(desc(taskActivities.createdAt), desc(taskActivities.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();
  return { rows, total, page, pageSize: PAGE_SIZE };
}

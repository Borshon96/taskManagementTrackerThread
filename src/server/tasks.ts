import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  MANUAL_STATUSES,
  OPEN_ASSIGNMENT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  taskAssignments,
  taskMessages,
  tasks,
  type Task,
  type TaskAssignment,
  type TaskStatus,
} from "@/db/schema";
import { nowIso } from "@/lib/clock";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";
import {
  assertManager,
  assertOpen,
  involvedUserIds,
  loadTask,
  loadVisibleTask,
  notify,
  quote,
  recordActivity,
  requireActiveUser,
  touchTask,
  userName,
  type Tx,
} from "./task-core";
import { parse } from "./users";

const id = z.coerce.number().int().positive();
const optionalId = z.union([id, z.literal(""), z.null()]).optional().transform((v) => (v ? Number(v) : null));
const note = z.string().trim().max(5000).optional().transform((v) => v || null);
const dueDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(10000).default(""),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  dueDate,
  assigneeId: optionalId,
  instruction: note,
});

const updateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate,
});

const assignSchema = z.object({ assigneeId: id, instruction: note });
const acknowledgeSchema = z.object({ response: z.enum(["received", "not_received"]), note });
const statusSchema = z.object({ status: z.enum(MANUAL_STATUSES), note });
const followUpSchema = z.object({
  assigneeId: id,
  instruction: z.string().trim().min(1, "Describe what the follow-up needs").max(5000),
});
const followUpStatusSchema = z.object({ status: z.enum(["in_progress", "completed"]), note });
const messageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(5000),
  recipientId: optionalId,
  assignmentId: optionalId,
});

/** Which manual statuses a task may move to from its current status. */
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  new: ["completed", "cancelled"],
  assigned: ["cancelled"],
  reassigned: ["cancelled"],
  received: ["in_progress", "waiting", "completed", "cancelled"],
  in_progress: ["waiting", "completed", "cancelled"],
  waiting: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function allowedStatusTransitions(status: TaskStatus) {
  return STATUS_TRANSITIONS[status];
}

function openFollowUps(tx: Tx, taskId: number) {
  return tx
    .select()
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.taskId, taskId),
        eq(taskAssignments.assignmentType, "follow_up"),
        inArray(taskAssignments.status, ["pending", "received", "not_received", "in_progress"]),
      ),
    )
    .all();
}

function currentPrimary(tx: Tx, taskId: number) {
  return tx
    .select()
    .from(taskAssignments)
    .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.assignmentType, "primary")))
    .orderBy(desc(taskAssignments.assignedAt), desc(taskAssignments.id))
    .get();
}

function loadAssignment(tx: Tx, taskId: number, assignmentId: number): TaskAssignment {
  const a = tx.select().from(taskAssignments).where(eq(taskAssignments.id, assignmentId)).get();
  if (!a || a.taskId !== taskId) throw notFound("Assignment not found");
  return a;
}

function insertMessage(
  tx: Tx,
  actor: SessionUser,
  task: Task,
  input: { message: string; recipientId?: number | null; assignmentId?: number | null },
  at: string,
) {
  const msg = tx
    .insert(taskMessages)
    .values({
      taskId: task.id,
      senderId: actor.id,
      recipientId: input.recipientId ?? null,
      assignmentId: input.assignmentId ?? null,
      message: input.message,
      createdAt: at,
    })
    .returning()
    .get();
  const to = input.recipientId ? ` to ${userName(tx, input.recipientId)}` : "";
  recordActivity(tx, {
    taskId: task.id,
    userId: actor.id,
    type: "message_added",
    description: `${actor.name} sent a message${to}: ${quote(input.message)}`,
    at,
    metadata: { messageId: msg.id, recipientId: msg.recipientId, assignmentId: msg.assignmentId },
  });
  touchTask(tx, task.id, at);
  return msg;
}

function assignPrimary(tx: Tx, actor: SessionUser, task: Task, assigneeId: number, instruction: string | null, at: string) {
  if (assigneeId === actor.id) throw badRequest("You cannot assign a task to yourself");
  if (assigneeId === task.currentAssignee) throw badRequest("The task is already assigned to that user");
  const target = requireActiveUser(tx, assigneeId);

  const previous = currentPrimary(tx, task.id);
  if (previous && OPEN_ASSIGNMENT_STATUSES.includes(previous.status)) {
    tx.update(taskAssignments).set({ status: "superseded" }).where(eq(taskAssignments.id, previous.id)).run();
  }

  const assignment = tx
    .insert(taskAssignments)
    .values({
      taskId: task.id,
      assignedBy: actor.id,
      assignedTo: target.id,
      assignmentType: "primary",
      instruction,
      assignedAt: at,
      status: "pending",
    })
    .returning()
    .get();

  const isReassign = !!previous;
  const newStatus: TaskStatus = isReassign ? "reassigned" : "assigned";
  touchTask(tx, task.id, at, { currentAssignee: target.id, status: newStatus });

  const fromName = task.currentAssignee ? userName(tx, task.currentAssignee) : null;
  recordActivity(tx, {
    taskId: task.id,
    userId: actor.id,
    type: isReassign ? "task_reassigned" : "task_assigned",
    description: isReassign
      ? `${actor.name} reassigned the task from ${fromName ?? "nobody"} to ${target.name}`
      : `${actor.name} assigned the task to ${target.name}`,
    at,
    metadata: {
      assignmentId: assignment.id,
      fromUserId: task.currentAssignee,
      toUserId: target.id,
      previousStatus: task.status,
      newStatus,
      instruction,
    },
  });

  notify(tx, [target.id], actor.id, {
    taskId: task.id,
    type: "assigned",
    title: `Task #${task.id} was assigned to you`,
    body: `${actor.name}: ${task.title}`,
    at,
  });
  if (isReassign) {
    notify(tx, [task.createdBy, task.currentAssignee], actor.id, {
      taskId: task.id,
      type: "status",
      title: `Task #${task.id} was reassigned to ${target.name}`,
      body: task.title,
      at,
    });
  }
  return assignment;
}

export function createTask(actor: SessionUser, input: unknown) {
  const data = parse(createSchema, input);
  return getDb().transaction((tx) => {
    const at = nowIso();
    const task = tx
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        createdBy: actor.id,
        status: "new",
        createdAt: at,
        updatedAt: at,
      })
      .returning()
      .get();
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: "task_created",
      description: `${actor.name} created Task #${task.id}: ${quote(task.title)}`,
      at,
      metadata: { title: task.title, priority: task.priority, dueDate: task.dueDate },
    });
    if (data.assigneeId) assignPrimary(tx, actor, task, data.assigneeId, data.instruction, at);
    return loadTask(tx, task.id);
  });
}

export function updateTask(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(updateSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    if (actor.role !== "admin" && task.createdBy !== actor.id) throw forbidden("Only the creator or an admin can edit");

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const next: Partial<Task> = {};
    for (const key of ["title", "description", "priority", "dueDate"] as const) {
      if (data[key] === undefined || (key === "dueDate" && !("dueDate" in (input as object)))) continue;
      if (data[key] !== task[key]) {
        changes[key] = { from: task[key], to: data[key] };
        Object.assign(next, { [key]: data[key] });
      }
    }
    if (Object.keys(changes).length === 0) return task;

    const at = nowIso();
    touchTask(tx, task.id, at, next);
    const labels: Record<string, string> = { title: "title", description: "description", priority: "priority", dueDate: "due date" };
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: "task_updated",
      description: `${actor.name} edited the ${Object.keys(changes).map((k) => labels[k]).join(", ")}`,
      at,
      metadata: { changes },
    });
    return loadTask(tx, task.id);
  });
}

export function assignTask(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(assignSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    assertManager(actor, task, "assign this task");
    return assignPrimary(tx, actor, task, data.assigneeId, data.instruction, nowIso());
  });
}

export function acknowledgeAssignment(actor: SessionUser, taskId: number, assignmentId: number, input: unknown) {
  const data = parse(acknowledgeSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    const assignment = loadAssignment(tx, task.id, assignmentId);
    if (assignment.assignedTo !== actor.id) throw forbidden("Only the assigned user can acknowledge this");
    if (assignment.status !== "pending" && assignment.status !== "not_received") {
      throw conflict("This assignment has already been acknowledged");
    }

    const at = nowIso();
    const received = data.response === "received";
    const isPrimary = assignment.assignmentType === "primary";
    tx.update(taskAssignments)
      .set(received ? { status: "received", receivedAt: at } : { status: "not_received" })
      .where(eq(taskAssignments.id, assignment.id))
      .run();

    const newStatus: TaskStatus = isPrimary && received ? "received" : task.status;
    touchTask(tx, task.id, at, { status: newStatus });

    const assigner = userName(tx, assignment.assignedBy);
    const what = isPrimary ? "the task" : "the follow-up action";
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: isPrimary
        ? received
          ? "task_received"
          : "task_not_received"
        : received
          ? "follow_up_received"
          : "follow_up_not_received",
      description: received
        ? `${actor.name} received ${what} from ${assigner}`
        : `${actor.name} marked ${what} from ${assigner} as Not Received`,
      at,
      metadata: {
        assignmentId: assignment.id,
        assignmentType: assignment.assignmentType,
        previousStatus: task.status,
        newStatus,
      },
    });
    if (data.note) {
      insertMessage(tx, actor, task, { message: data.note, recipientId: assignment.assignedBy, assignmentId: assignment.id }, at);
    }

    notify(tx, [assignment.assignedBy, isPrimary ? task.createdBy : null], actor.id, {
      taskId: task.id,
      type: "acknowledged",
      title: `${actor.name} ${received ? "received" : "did not receive"} ${what} on Task #${task.id}`,
      body: task.title,
      at,
    });
  });
}

export function changeTaskStatus(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(statusSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    assertManager(actor, task, "change the status");
    if (!STATUS_TRANSITIONS[task.status].includes(data.status)) {
      throw conflict(`Cannot move from ${TASK_STATUS_LABELS[task.status]} to ${TASK_STATUS_LABELS[data.status]}`);
    }

    const at = nowIso();
    const from = TASK_STATUS_LABELS[task.status];
    const to = TASK_STATUS_LABELS[data.status];
    const primary = currentPrimary(tx, task.id);

    if (data.status === "completed") {
      const open = openFollowUps(tx, task.id);
      if (open.length > 0) {
        throw conflict(`Finish or wait for ${open.length} open follow-up${open.length === 1 ? "" : "s"} before completing`);
      }
      if (primary && OPEN_ASSIGNMENT_STATUSES.includes(primary.status)) {
        tx.update(taskAssignments)
          .set({ status: "completed", completedAt: at })
          .where(eq(taskAssignments.id, primary.id))
          .run();
      }
      touchTask(tx, task.id, at, { status: "completed", completedAt: at, completedBy: actor.id });
    } else if (data.status === "cancelled") {
      tx.update(taskAssignments)
        .set({ status: "cancelled" })
        .where(and(eq(taskAssignments.taskId, task.id), inArray(taskAssignments.status, [...OPEN_ASSIGNMENT_STATUSES])))
        .run();
      touchTask(tx, task.id, at, { status: "cancelled" });
    } else {
      touchTask(tx, task.id, at, { status: data.status });
    }

    const type = data.status === "completed" ? "task_completed" : data.status === "cancelled" ? "task_cancelled" : "status_changed";
    const description =
      data.status === "completed"
        ? `${actor.name} marked Task #${task.id} as Completed`
        : data.status === "cancelled"
          ? `${actor.name} cancelled Task #${task.id}`
          : `${actor.name} changed status from ${from} to ${to}`;
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type,
      description,
      at,
      metadata: { from: task.status, to: data.status },
    });
    if (data.note) insertMessage(tx, actor, task, { message: data.note }, at);

    notify(tx, involvedUserIds(tx, task), actor.id, {
      taskId: task.id,
      type: data.status === "completed" ? "completed" : "status",
      title:
        data.status === "completed"
          ? `Task #${task.id} was completed by ${actor.name}`
          : data.status === "cancelled"
            ? `Task #${task.id} was cancelled by ${actor.name}`
            : `Task #${task.id} is now ${to}`,
      body: task.title,
      at,
    });
    return loadTask(tx, task.id);
  });
}

export function assignFollowUp(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(followUpSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    assertManager(actor, task, "assign follow-ups");
    if (data.assigneeId === actor.id) throw badRequest("You cannot assign a follow-up to yourself");
    const target = requireActiveUser(tx, data.assigneeId);

    const at = nowIso();
    const assignment = tx
      .insert(taskAssignments)
      .values({
        taskId: task.id,
        assignedBy: actor.id,
        assignedTo: target.id,
        assignmentType: "follow_up",
        instruction: data.instruction,
        assignedAt: at,
        status: "pending",
      })
      .returning()
      .get();
    touchTask(tx, task.id, at);
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: "follow_up_assigned",
      description: `${actor.name} assigned a follow-up action to ${target.name}: ${quote(data.instruction)}`,
      at,
      metadata: { assignmentId: assignment.id, toUserId: target.id, instruction: data.instruction },
    });
    notify(tx, [target.id], actor.id, {
      taskId: task.id,
      type: "follow_up",
      title: `${actor.name} assigned you a follow-up on Task #${task.id}`,
      body: data.instruction,
      at,
    });
    return assignment;
  });
}

export function updateFollowUpStatus(actor: SessionUser, taskId: number, assignmentId: number, input: unknown) {
  const data = parse(followUpStatusSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    const assignment = loadAssignment(tx, task.id, assignmentId);
    if (assignment.assignmentType !== "follow_up") throw badRequest("Use the task status for the main assignment");
    if (assignment.assignedTo !== actor.id) throw forbidden("Only the assigned user can update this follow-up");
    const allowed = data.status === "in_progress" ? ["received"] : ["received", "in_progress"];
    if (!allowed.includes(assignment.status)) {
      throw conflict(
        assignment.status === "pending" || assignment.status === "not_received"
          ? "Mark the follow-up as Received first"
          : "This follow-up can no longer be updated",
      );
    }

    const at = nowIso();
    const completed = data.status === "completed";
    tx.update(taskAssignments)
      .set(completed ? { status: "completed", completedAt: at } : { status: "in_progress" })
      .where(eq(taskAssignments.id, assignment.id))
      .run();
    touchTask(tx, task.id, at);
    recordActivity(tx, {
      taskId: task.id,
      userId: actor.id,
      type: completed ? "follow_up_completed" : "follow_up_in_progress",
      description: completed
        ? `${actor.name} completed the follow-up action for ${userName(tx, assignment.assignedBy)}`
        : `${actor.name} started working on the follow-up action`,
      at,
      metadata: { assignmentId: assignment.id, from: assignment.status, to: data.status },
    });
    if (data.note) {
      insertMessage(tx, actor, task, { message: data.note, recipientId: assignment.assignedBy, assignmentId: assignment.id }, at);
    }
    notify(tx, [assignment.assignedBy, task.currentAssignee], actor.id, {
      taskId: task.id,
      type: completed ? "follow_up_completed" : "status",
      title: completed
        ? `${actor.name} completed a follow-up on Task #${task.id}`
        : `${actor.name} is working on a follow-up on Task #${task.id}`,
      body: assignment.instruction ?? task.title,
      at,
    });
  });
}

export function addMessage(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(messageSchema, input);
  return getDb().transaction((tx) => {
    const task = loadVisibleTask(tx, actor, taskId);
    assertOpen(task);
    const recipients = involvedUserIds(tx, task);
    if (data.recipientId) {
      if (data.recipientId === actor.id) throw badRequest("Choose someone other than yourself");
      requireActiveUser(tx, data.recipientId);
      if (!recipients.includes(data.recipientId)) {
        throw badRequest("Messages can only be addressed to people on this task. Assign a follow-up to bring someone in.");
      }
    }
    if (data.assignmentId) loadAssignment(tx, task.id, data.assignmentId);

    const at = nowIso();
    const msg = insertMessage(tx, actor, task, data, at);
    notify(tx, [...recipients, data.recipientId], actor.id, {
      taskId: task.id,
      type: "message",
      title: data.recipientId
        ? `${actor.name} messaged you on Task #${task.id}`
        : `${actor.name} replied on Task #${task.id}`,
      body: data.message.slice(0, 200),
      at,
    });
    return msg;
  });
}

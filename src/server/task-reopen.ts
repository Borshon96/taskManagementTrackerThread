import { z } from "zod";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { nowIso } from "@/lib/clock";
import { conflict, forbidden } from "@/lib/errors";
import type { SessionUser } from "./auth";
import {
  ensureAdminsOnTask,
  ensureProjectMembersOnTask,
  ensureTaskMember,
  involvedUserIds,
  isTerminal,
  loadTask,
  loadVisibleTask,
  notify,
  quote,
  recordActivity,
} from "./task-core";
import { parse } from "./users";

const note = z
  .union([z.string().trim().max(5000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v.trim() || null));
const reopenSchema = z.object({ note });

/** Reopen a closed task as a new row (Turbopack-safe module — import from API routes). */
export function reopenTask(actor: SessionUser, taskId: number, input: unknown) {
  const data = parse(reopenSchema, input ?? {});
  return getDb().transaction((tx) => {
    const source = loadVisibleTask(tx, actor, taskId);
    if (!isTerminal(source)) throw conflict("Only completed or cancelled tasks can be reopened");
    if (actor.role !== "admin" && source.createdBy !== actor.id) {
      throw forbidden("Only the task creator or an admin can reopen this task");
    }

    const at = nowIso();
    const newTask = tx
      .insert(tasks)
      .values({
        channelId: source.channelId,
        title: source.title,
        description: source.description,
        createdBy: source.createdBy,
        priority: source.priority,
        dueDate: source.dueDate,
        status: "new",
        reopenedFromTaskId: source.id,
        createdAt: at,
        updatedAt: at,
      })
      .returning()
      .get();

    const reopenMeta = { newTaskId: newTask.id, reopenedFromTaskId: source.id, note: data.note };
    recordActivity(tx, {
      taskId: source.id,
      userId: actor.id,
      type: "task_reopened",
      description: `${actor.name} reopened this task as Task #${newTask.id}`,
      at,
      metadata: reopenMeta,
    });
    ensureTaskMember(tx, newTask.id, newTask.createdBy, actor.id, at);
    ensureProjectMembersOnTask(tx, newTask.id, newTask.channelId, actor.id, at);
    ensureAdminsOnTask(tx, newTask.id, actor.id, at);

    const createdActivity = recordActivity(tx, {
      taskId: newTask.id,
      userId: actor.id,
      type: "task_created",
      description: `${actor.name} reopened Task #${source.id} as Task #${newTask.id}: ${quote(newTask.title)}`,
      at,
      metadata: {
        ...reopenMeta,
        title: newTask.title,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
      },
    });

    notify(tx, involvedUserIds(tx, newTask), actor.id, {
      taskId: newTask.id,
      type: "status",
      title: `Task #${source.id} was reopened as Task #${newTask.id}`,
      body: newTask.title,
      at,
      activityId: createdActivity.id,
    });

    return { task: loadTask(tx, newTask.id), sourceTaskId: source.id };
  });
}

import { eq, inArray, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  notifications,
  taskActivities,
  taskAssignments,
  taskMessages,
  tasks,
  users,
} from "@/db/schema";

const HISTORY_DELETE_FLAG = "allow_history_delete";

function setHistoryDeleteAllowed(tx: DB, allowed: boolean) {
  const value = allowed ? 1 : 0;
  tx.run(
    sql`INSERT INTO internal_flags (key, value) VALUES (${HISTORY_DELETE_FLAG}, ${value}) ON CONFLICT(key) DO UPDATE SET value = ${value}`,
  );
}

export function taskIdsLinkedToUser(db: DB, userId: number): number[] {
  const ids = new Set<number>();
  const taskRows = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(or(eq(tasks.createdBy, userId), eq(tasks.currentAssignee, userId), eq(tasks.completedBy, userId)))
    .all();
  for (const row of taskRows) ids.add(row.id);

  for (const row of db
    .select({ taskId: taskAssignments.taskId })
    .from(taskAssignments)
    .where(or(eq(taskAssignments.assignedBy, userId), eq(taskAssignments.assignedTo, userId)))
    .all()) {
    ids.add(row.taskId);
  }
  for (const row of db
    .select({ taskId: taskMessages.taskId })
    .from(taskMessages)
    .where(or(eq(taskMessages.senderId, userId), eq(taskMessages.recipientId, userId)))
    .all()) {
    ids.add(row.taskId);
  }
  for (const row of db
    .select({ taskId: taskActivities.taskId })
    .from(taskActivities)
    .where(eq(taskActivities.userId, userId))
    .all()) {
    ids.add(row.taskId);
  }

  return [...ids];
}

export type UserDeleteSummary = { deletedTaskIds: number[] };

export function purgeUserAndLinkedData(db: DB, userId: number): UserDeleteSummary {
  const taskIds = taskIdsLinkedToUser(db, userId);

  db.transaction((tx) => {
    setHistoryDeleteAllowed(tx, true);
    try {
      tx.delete(notifications).where(eq(notifications.userId, userId)).run();
      if (taskIds.length > 0) {
        tx.delete(notifications).where(inArray(notifications.taskId, taskIds)).run();
        tx.delete(taskMessages).where(inArray(taskMessages.taskId, taskIds)).run();
        tx.delete(taskActivities).where(inArray(taskActivities.taskId, taskIds)).run();
        tx.delete(taskAssignments).where(inArray(taskAssignments.taskId, taskIds)).run();
        tx.delete(tasks).where(inArray(tasks.id, taskIds)).run();
      }
      tx.delete(users).where(eq(users.id, userId)).run();
    } finally {
      setHistoryDeleteAllowed(tx, false);
    }
  });

  return { deletedTaskIds: taskIds };
}

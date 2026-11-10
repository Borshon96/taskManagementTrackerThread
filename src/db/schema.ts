import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  ACTIVITY_TYPES,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  USER_ROLES,
} from "../lib/constants";

export * from "../lib/constants";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("user"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    currentAssignee: integer("current_assignee").references(() => users.id),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("new"),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("normal"),
    dueDate: text("due_date"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    completedAt: text("completed_at"),
    completedBy: integer("completed_by").references(() => users.id),
  },
  (t) => [
    index("tasks_status_idx").on(t.status),
    index("tasks_created_by_idx").on(t.createdBy),
    index("tasks_current_assignee_idx").on(t.currentAssignee),
    index("tasks_created_at_idx").on(t.createdAt),
  ],
);

export const taskAssignments = sqliteTable(
  "task_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    assignedBy: integer("assigned_by")
      .notNull()
      .references(() => users.id),
    assignedTo: integer("assigned_to")
      .notNull()
      .references(() => users.id),
    assignmentType: text("assignment_type", { enum: ASSIGNMENT_TYPES }).notNull(),
    instruction: text("instruction"),
    assignedAt: text("assigned_at").notNull(),
    receivedAt: text("received_at"),
    completedAt: text("completed_at"),
    status: text("status", { enum: ASSIGNMENT_STATUSES }).notNull().default("pending"),
  },
  (t) => [
    index("task_assignments_task_idx").on(t.taskId, t.assignedAt),
    index("task_assignments_assigned_to_idx").on(t.assignedTo, t.status),
  ],
);

export const taskMessages = sqliteTable(
  "task_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    recipientId: integer("recipient_id").references(() => users.id),
    assignmentId: integer("assignment_id").references(() => taskAssignments.id),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("task_messages_task_idx").on(t.taskId, t.createdAt), index("task_messages_sender_idx").on(t.senderId)],
);

export const taskActivities = sqliteTable(
  "task_activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    activityType: text("activity_type", { enum: ACTIVITY_TYPES }).notNull(),
    description: text("description").notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("task_activities_task_idx").on(t.taskId, t.createdAt),
    index("task_activities_created_at_idx").on(t.createdAt),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    taskId: integer("task_id").references(() => tasks.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.isRead, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type TaskMessage = typeof taskMessages.$inferSelect;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

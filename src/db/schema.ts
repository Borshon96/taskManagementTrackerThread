import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const channels = sqliteTable(
  "channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("channels_created_at_idx").on(t.createdAt)],
);

export const channelMembers = sqliteTable(
  "channel_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedBy: integer("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("channel_members_channel_user_unique").on(t.channelId, t.userId),
    index("channel_members_user_idx").on(t.userId),
  ],
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
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id),
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
    reopenedFromTaskId: integer("reopened_from_task_id").references((): AnySQLiteColumn => tasks.id),
  },
  (t) => [
    index("tasks_channel_idx").on(t.channelId),
    index("tasks_reopened_from_idx").on(t.reopenedFromTaskId),
    index("tasks_status_idx").on(t.status),
    index("tasks_created_by_idx").on(t.createdBy),
    index("tasks_current_assignee_idx").on(t.currentAssignee),
    index("tasks_created_at_idx").on(t.createdAt),
  ],
);

export const taskMembers = sqliteTable(
  "task_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedBy: integer("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("task_members_task_user_unique").on(t.taskId, t.userId),
    index("task_members_user_idx").on(t.userId),
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
    parentMessageId: integer("parent_message_id").references((): AnySQLiteColumn => taskMessages.id),
    parentActivityId: integer("parent_activity_id").references(() => taskActivities.id),
    inReplyToMessageId: integer("in_reply_to_message_id").references((): AnySQLiteColumn => taskMessages.id),
    inReplyToActivityId: integer("in_reply_to_activity_id").references(() => taskActivities.id),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("task_messages_task_idx").on(t.taskId, t.createdAt),
    index("task_messages_sender_idx").on(t.senderId),
    index("task_messages_parent_idx").on(t.parentMessageId),
    index("task_messages_parent_activity_idx").on(t.parentActivityId),
    index("task_messages_in_reply_message_idx").on(t.inReplyToMessageId),
    index("task_messages_in_reply_activity_idx").on(t.inReplyToActivityId),
  ],
);

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => taskMessages.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("message_attachments_message_idx").on(t.messageId)],
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
    activityId: integer("activity_id").references(() => taskActivities.id),
    messageId: integer("message_id").references(() => taskMessages.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.isRead, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type TaskMessage = typeof taskMessages.$inferSelect;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type MessageAttachment = typeof messageAttachments.$inferSelect;

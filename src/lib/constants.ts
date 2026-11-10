export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TASK_STATUSES = [
  "new",
  "assigned",
  "received",
  "in_progress",
  "waiting",
  "reassigned",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TERMINAL_STATUSES: readonly TaskStatus[] = ["completed", "cancelled"];
export const MANUAL_STATUSES = ["in_progress", "waiting", "completed", "cancelled"] as const;
export type ManualStatus = (typeof MANUAL_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const ASSIGNMENT_TYPES = ["primary", "follow_up"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ASSIGNMENT_STATUSES = [
  "pending",
  "received",
  "not_received",
  "in_progress",
  "completed",
  "superseded",
  "cancelled",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const OPEN_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ["pending", "received", "not_received", "in_progress"];

export const ACTIVITY_TYPES = [
  "task_created",
  "task_updated",
  "task_assigned",
  "task_reassigned",
  "task_received",
  "task_not_received",
  "status_changed",
  "message_added",
  "follow_up_assigned",
  "follow_up_received",
  "follow_up_not_received",
  "follow_up_in_progress",
  "follow_up_completed",
  "task_completed",
  "task_cancelled",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "New",
  assigned: "Assigned",
  received: "Received",
  in_progress: "In Progress",
  waiting: "Waiting",
  reassigned: "Reassigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: "Awaiting acknowledgement",
  received: "Received",
  not_received: "Not Received",
  in_progress: "In Progress",
  completed: "Completed",
  superseded: "Reassigned",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  task_created: "Created",
  task_updated: "Edited",
  task_assigned: "Assignment",
  task_reassigned: "Reassignment",
  task_received: "Received",
  task_not_received: "Not Received",
  status_changed: "Status",
  message_added: "Message",
  follow_up_assigned: "Follow-up",
  follow_up_received: "Follow-up Received",
  follow_up_not_received: "Follow-up Not Received",
  follow_up_in_progress: "Follow-up In Progress",
  follow_up_completed: "Follow-up Completed",
  task_completed: "Completed",
  task_cancelled: "Cancelled",
};

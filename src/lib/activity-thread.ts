import type { ActivityType } from "@/lib/constants";
import type { ActivityView } from "@/server/task-queries";

const ASSIGN_ACTIVITY_TYPES = new Set<ActivityType>(["task_assigned", "task_reassigned", "follow_up_assigned"]);

const ASSIGNMENT_NESTED_TYPES = new Set<ActivityType>([
  "task_assigned",
  "task_reassigned",
  "follow_up_assigned",
  "task_received",
  "task_not_received",
  "follow_up_received",
  "follow_up_not_received",
  "follow_up_in_progress",
  "follow_up_completed",
  "message_added",
]);

export function assignmentIdOf(a: ActivityView): number | null {
  if (typeof a.metadata.assignmentId === "number") return a.metadata.assignmentId;
  if (a.message?.assignmentId) return a.message.assignmentId;
  return null;
}

/** Prefer the first top-level message on an assignment, otherwise the assign activity. */
export function resolveAssignmentAnchors(activities: ActivityView[]): Map<number, number> {
  const messageActivityByMessageId = new Map<number, number>();
  for (const a of activities) {
    if (a.activityType === "message_added" && a.message) {
      messageActivityByMessageId.set(a.message.id, a.id);
    }
  }

  const anchors = new Map<number, number>();
  for (const a of activities) {
    if (a.activityType !== "message_added" || !a.message?.assignmentId || a.message.parentMessageId) continue;
    const aid = a.message.assignmentId;
    if (!anchors.has(aid)) anchors.set(aid, a.id);
  }
  for (const a of activities) {
    const aid = typeof a.metadata.assignmentId === "number" ? a.metadata.assignmentId : null;
    if (!aid || anchors.has(aid)) continue;
    if (ASSIGN_ACTIVITY_TYPES.has(a.activityType)) anchors.set(aid, a.id);
  }
  return anchors;
}

export function parentActivityId(a: ActivityView, activities: ActivityView[], assignmentAnchors: Map<number, number>): number | null {
  const messageActivityByMessageId = new Map<number, number>();
  for (const act of activities) {
    if (act.activityType === "message_added" && act.message) {
      messageActivityByMessageId.set(act.message.id, act.id);
    }
  }

  if (a.message?.parentMessageId) {
    return messageActivityByMessageId.get(a.message.parentMessageId) ?? null;
  }
  if (a.message?.parentActivityId) {
    return a.message.parentActivityId;
  }
  if (a.message?.inReplyToMessageId || a.message?.inReplyToActivityId) {
    return null;
  }

  if (a.activityType === "message_added") return null;

  const aid = assignmentIdOf(a);
  if (aid && ASSIGNMENT_NESTED_TYPES.has(a.activityType)) {
    const anchor = assignmentAnchors.get(aid);
    if (anchor && anchor !== a.id) return anchor;
  }

  return null;
}

export type ActivityTreeNode = {
  activity: ActivityView;
  children: ActivityTreeNode[];
};

export function buildActivityTree(activities: ActivityView[]): ActivityTreeNode[] {
  const assignmentAnchors = resolveAssignmentAnchors(activities);
  const childrenByParent = new Map<number, ActivityView[]>();
  const roots: ActivityView[] = [];

  for (const a of activities) {
    const parentId = parentActivityId(a, activities, assignmentAnchors);
    if (parentId) {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(a);
      childrenByParent.set(parentId, list);
    } else {
      roots.push(a);
    }
  }

  const sortNewestFirst = (list: ActivityView[]) =>
    [...list].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id - x.id);

  function toNode(a: ActivityView): ActivityTreeNode {
    const kids = sortNewestFirst(childrenByParent.get(a.id) ?? []).map(toNode);
    return { activity: a, children: kids };
  }

  return sortNewestFirst(roots).map(toNode);
}

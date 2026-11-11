import { resolveAssignmentAnchors } from "@/lib/activity-thread";
import type { ActivityView } from "@/server/task-queries";

const AWAITING_STATUSES = new Set(["pending", "not_received"]);

export function assignmentIdsAwaitingAck(assignments: { id: number; status: string }[]) {
  return new Set(assignments.filter((a) => AWAITING_STATUSES.has(a.status)).map((a) => a.id));
}

export function activityIdsForAssignments(activities: ActivityView[], assignmentIds: Set<number>) {
  if (assignmentIds.size === 0) return new Set<number>();
  const anchors = resolveAssignmentAnchors(activities);
  const out = new Set<number>();
  for (const [assignmentId, activityId] of anchors) {
    if (assignmentIds.has(assignmentId)) out.add(activityId);
  }
  return out;
}

export function activityIdsAwaitingAck(activities: ActivityView[], assignments: { id: number; status: string }[]) {
  return activityIdsForAssignments(activities, assignmentIdsAwaitingAck(assignments));
}

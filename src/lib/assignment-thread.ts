import type { ActivityView } from "@/server/task-queries";
import { resolveAssignmentAnchors } from "@/lib/activity-thread";

export type AssignmentThreadAction =
  | {
      mode: "acknowledge";
      assignmentId: number;
      assignmentType: "primary" | "follow_up";
      assignedByName: string;
      instruction: string | null;
      status: string;
    }
  | {
      mode: "follow_up";
      assignmentId: number;
      assignedByName: string;
      instruction: string | null;
      status: string;
    };

export function buildAssignmentThreadActions(detail: {
  myAcknowledgements: {
    id: number;
    assignmentType: "primary" | "follow_up";
    assignedByName: string;
    instruction: string | null;
    status: string;
  }[];
  myFollowUps: { id: number; assignedByName: string; instruction: string | null; status: string }[];
}): Record<number, AssignmentThreadAction> {
  const map: Record<number, AssignmentThreadAction> = {};
  for (const a of detail.myAcknowledgements) {
    map[a.id] = {
      mode: "acknowledge",
      assignmentId: a.id,
      assignmentType: a.assignmentType,
      assignedByName: a.assignedByName,
      instruction: a.instruction,
      status: a.status,
    };
  }
  for (const f of detail.myFollowUps) {
    map[f.id] = {
      mode: "follow_up",
      assignmentId: f.id,
      assignedByName: f.assignedByName,
      instruction: f.instruction,
      status: f.status,
    };
  }
  return map;
}

/** Interactive card on the thread anchor (message or assign event) for each assignment. */
export function buildThreadActionAnchors(
  activities: ActivityView[],
  assignmentActions: Record<number, AssignmentThreadAction>,
): Map<number, number> {
  const assignmentAnchors = resolveAssignmentAnchors(activities);
  const anchors = new Map<number, number>();
  for (const action of Object.values(assignmentActions)) {
    const anchor = assignmentAnchors.get(action.assignmentId);
    if (anchor) anchors.set(action.assignmentId, anchor);
  }
  return anchors;
}

export function threadActionAtActivity(
  activity: ActivityView,
  anchors: Map<number, number>,
  assignmentActions: Record<number, AssignmentThreadAction>,
): AssignmentThreadAction | null {
  for (const [assignmentId, activityId] of anchors.entries()) {
    if (activityId === activity.id) return assignmentActions[assignmentId] ?? null;
  }
  return null;
}

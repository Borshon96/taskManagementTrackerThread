export type AssigneeChip = {
  assignmentId: number;
  userId: number;
  name: string;
  assignmentType: "primary" | "follow_up";
  status: string;
};

/** One chip per person; primary beats follow-up when both exist for the same user. */
export function dedupeActiveAssignees(rows: AssigneeChip[]): AssigneeChip[] {
  const best = new Map<number, AssigneeChip>();
  for (const a of rows) {
    const prev = best.get(a.userId);
    if (!prev) {
      best.set(a.userId, a);
      continue;
    }
    if (a.assignmentType === "primary" && prev.assignmentType !== "primary") {
      best.set(a.userId, a);
    } else if (a.assignmentType === prev.assignmentType && a.assignmentId > prev.assignmentId) {
      best.set(a.userId, a);
    }
  }
  const order: number[] = [];
  const seen = new Set<number>();
  for (const a of rows) {
    if (!seen.has(a.userId)) {
      seen.add(a.userId);
      order.push(a.userId);
    }
  }
  return order.map((id) => best.get(id)!);
}

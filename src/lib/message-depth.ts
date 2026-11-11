import type { taskMessages } from "@/db/schema";

type MessageRow = Pick<
  typeof taskMessages.$inferSelect,
  "id" | "parentMessageId" | "parentActivityId"
>;

export function messageIsNested(m: Pick<MessageRow, "parentMessageId" | "parentActivityId">) {
  return !!(m.parentMessageId || m.parentActivityId);
}

export function computeMessageDepth(
  getMessage: (id: number) => MessageRow | undefined,
  messageId: number,
  memo = new Map<number, number>(),
): number {
  const cached = memo.get(messageId);
  if (cached !== undefined) return cached;

  const m = getMessage(messageId);
  if (!m || !messageIsNested(m)) {
    memo.set(messageId, 0);
    return 0;
  }

  let parentDepth = 0;
  if (m.parentMessageId) {
    parentDepth = computeMessageDepth(getMessage, m.parentMessageId, memo);
  } else if (m.parentActivityId) {
    parentDepth = 0;
  }

  const depth = parentDepth + 1;
  memo.set(messageId, depth);
  return depth;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/constants";
import type { TaskFocusTarget } from "@/lib/notification-link";
import { scrollToFocusTarget } from "@/lib/timeline-focus";
import type { RefObject } from "react";
import { formatDate, formatTime, formatTimestamp } from "@/lib/format";
import type { ActivityView } from "@/server/task-queries";
import { buildActivityTree, type ActivityTreeNode } from "@/lib/activity-thread";
import { messageIsNested } from "@/lib/message-depth";
import {
  buildThreadActionAnchors,
  threadActionAtActivity,
  type AssignmentThreadAction,
} from "@/lib/assignment-thread";
import { AssignmentThreadCard } from "./AssignmentThreadCard";
import { MessageAttachments } from "./MessageAttachments";
import { Avatar } from "./ui";

export type ReplyTarget =
  | { kind: "message"; messageId: number; authorName: string; preview: string; threadDepth: number; promote: boolean }
  | { kind: "activity"; activityId: number; authorName: string; preview: string; threadDepth: number; promote: boolean };

function replyPreview(a: ActivityView): string {
  if (a.activityType === "message_added" && a.message?.body.trim()) return a.message.body.slice(0, 120);
  if (a.activityType === "message_added" && a.message?.attachments.length) return "(attachment)";
  return a.description.slice(0, 120);
}

function canShowReply(activity: ActivityView, threadDepth: number, currentUserId: number | undefined) {
  if (!currentUserId) return true;
  if (
    activity.activityType === "message_added" &&
    activity.message &&
    messageIsNested(activity.message) &&
    activity.userId === currentUserId
  ) {
    return false;
  }
  return true;
}

function ReplyButton({
  activity: a,
  threadDepth,
  onReply,
}: {
  activity: ActivityView;
  threadDepth: number;
  onReply: (target: ReplyTarget) => void;
}) {
  const preview = replyPreview(a);
  const promote = threadDepth >= 2;
  return (
    <button
      type="button"
      className="mt-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
      onClick={() =>
        a.activityType === "message_added" && a.message
          ? onReply({ kind: "message", messageId: a.message.id, authorName: a.userName, preview, threadDepth, promote })
          : onReply({ kind: "activity", activityId: a.id, authorName: a.userName, preview, threadDepth, promote })
      }
    >
      Reply
    </button>
  );
}

type Tone = { dot: string; chip: string };

const TONES: Record<string, Tone> = {
  neutral: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
  assign: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  received: { dot: "bg-cyan-500", chip: "bg-cyan-50 text-cyan-800" },
  negative: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700" },
  status: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  message: { dot: "bg-white ring-2 ring-slate-300", chip: "bg-slate-100 text-slate-600" },
  followUp: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  done: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
};

const TYPE_TONE: Record<ActivityType, keyof typeof TONES> = {
  task_created: "neutral",
  task_updated: "neutral",
  task_assigned: "assign",
  task_reassigned: "assign",
  task_received: "received",
  task_not_received: "negative",
  status_changed: "status",
  message_added: "message",
  follow_up_assigned: "followUp",
  follow_up_received: "followUp",
  follow_up_not_received: "negative",
  follow_up_in_progress: "followUp",
  follow_up_completed: "followUp",
  task_completed: "done",
  task_cancelled: "negative",
  task_reopened: "status",
  task_member_added: "neutral",
  task_member_removed: "neutral",
};

export function ActivityTimeline({
  activities,
  taskId,
  assignmentActions = {},
  currentUserId,
  onReply,
  focusTarget = null,
  highlightFromNotification = false,
  scrollContainerRef,
  allActivities,
}: {
  activities: ActivityView[];
  taskId?: number;
  assignmentActions?: Record<number, AssignmentThreadAction>;
  currentUserId?: number;
  onReply?: (target: ReplyTarget) => void;
  focusTarget?: TaskFocusTarget | null;
  highlightFromNotification?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Full activity list (before thread filters) for focus fallbacks. */
  allActivities?: ActivityView[];
}) {
  const [focusPulse, setFocusPulse] = useState(false);
  const focusPool = allActivities ?? activities;
  const focusPoolRef = useRef(focusPool);
  focusPoolRef.current = focusPool;
  const scrollConsumedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightFromNotification) {
      scrollConsumedRef.current = null;
      setFocusPulse(false);
      return;
    }
    if (!focusTarget) return;
    const token = `${focusTarget.kind}-${focusTarget.id}`;
    if (scrollConsumedRef.current === token) return;
    scrollConsumedRef.current = token;
    setFocusPulse(true);

    const root = scrollContainerRef?.current ?? null;
    const run = () => scrollToFocusTarget(focusTarget, focusPoolRef.current, root);
    run();
    const delays = [100, 250, 500, 900, 1400];
    const timers = delays.map((ms) => window.setTimeout(run, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focusTarget, highlightFromNotification, scrollContainerRef]);

  useEffect(() => {
    if (!focusPulse) return;
    const t = window.setTimeout(() => setFocusPulse(false), 8000);
    return () => window.clearTimeout(t);
  }, [focusPulse]);
  const actionAnchors = buildThreadActionAnchors(activities, assignmentActions);
  const roots = buildActivityTree(activities);

  const groups: { day: string; items: ActivityTreeNode[] }[] = [];
  for (const node of roots) {
    const day = formatDate(node.activity.createdAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(node);
  }

  if (roots.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-5">
      {groups.map((g) => (
        <li key={g.day}>
          <div className="sticky top-0 z-[1] -mx-1 mb-2 bg-white px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {g.day}
          </div>
          <ol className="relative border-l-2 border-slate-200 pl-5">
            {g.items.map((node) => (
              <TimelineBranch
                key={node.activity.id}
                node={node}
                depth={0}
                taskId={taskId}
                actionAnchors={actionAnchors}
                assignmentActions={assignmentActions}
                currentUserId={currentUserId}
                onReply={onReply}
                focusTarget={focusTarget}
                highlight={highlightFromNotification && focusPulse}
              />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function TimelineBranch({
  node,
  depth,
  taskId,
  actionAnchors,
  assignmentActions,
  currentUserId,
  onReply,
  focusTarget,
  highlight,
}: {
  node: ActivityTreeNode;
  depth: number;
  taskId?: number;
  actionAnchors: Map<number, number>;
  assignmentActions: Record<number, AssignmentThreadAction>;
  currentUserId?: number;
  onReply?: (target: ReplyTarget) => void;
  focusTarget?: TaskFocusTarget | null;
  highlight?: boolean;
}) {
  return (
  <li className="pb-3 last:pb-0">
      <TimelineItem
        activity={node.activity}
        threadDepth={depth}
        taskId={taskId}
        actionAnchors={actionAnchors}
        assignmentActions={assignmentActions}
        currentUserId={currentUserId}
        onReply={onReply}
        focusTarget={focusTarget}
        highlight={highlight}
      />
      {node.children.length > 0 && (
        <ol className={`mt-1 space-y-2 border-l border-slate-200 ${depth === 0 ? "ml-8" : "ml-5"} pl-4`}>
          {node.children.map((child) => (
            <TimelineBranch
              key={child.activity.id}
              node={child}
              depth={depth + 1}
              taskId={taskId}
              actionAnchors={actionAnchors}
              assignmentActions={assignmentActions}
              currentUserId={currentUserId}
              onReply={onReply}
              focusTarget={focusTarget}
              highlight={highlight}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function isFocused(
  a: ActivityView,
  focusTarget: TaskFocusTarget | null | undefined,
): boolean {
  if (!focusTarget) return false;
  if (focusTarget.kind === "activity") return a.id === focusTarget.id;
  return a.message?.id === focusTarget.id;
}

function TimelineItem({
  activity: a,
  threadDepth,
  taskId,
  actionAnchors,
  assignmentActions,
  currentUserId,
  onReply,
  focusTarget,
  highlight,
}: {
  activity: ActivityView;
  threadDepth: number;
  taskId?: number;
  actionAnchors: Map<number, number>;
  assignmentActions: Record<number, AssignmentThreadAction>;
  currentUserId?: number;
  onReply?: (target: ReplyTarget) => void;
  focusTarget?: TaskFocusTarget | null;
  highlight?: boolean;
}) {
  const threadAction = taskId ? threadActionAtActivity(a, actionAnchors, assignmentActions) : null;
  const tone = TONES[TYPE_TONE[a.activityType]];
  const isMessage = a.activityType === "message_added" && a.message;
  const showReply = !!onReply && canShowReply(a, threadDepth, currentUserId);
  const compactNested = threadDepth > 0;
  const instruction =
    a.activityType === "follow_up_assigned" || a.activityType === "task_assigned" || a.activityType === "task_reassigned"
      ? (a.metadata.instruction as string | null | undefined)
      : null;
  const changes =
    a.activityType === "task_updated"
      ? (a.metadata.changes as Record<string, { from: unknown; to: unknown }> | undefined)
      : undefined;
  const focused = highlight && isFocused(a, focusTarget);
  const focusCard =
    "border-2 border-blue-600 bg-blue-50/30 shadow-lg shadow-blue-200/50 ring-[3px] ring-blue-500/35";
  const focusMessageWrap =
    "rounded-md border-2 border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/40 shadow-md";
  return (
    <div id={`activity-${a.id}`} className="relative scroll-mt-6 scroll-mb-6" data-activity-type={a.activityType}>
      <span className={`absolute -left-[25px] top-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden />
      <div
        className={`rounded-lg border bg-white transition-[box-shadow,border-color,background-color] duration-300 ${
          focused ? focusCard : "border-slate-100"
        } ${compactNested ? "px-2.5 py-2" : "px-2.5 py-2.5 shadow-sm"}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Avatar name={a.userName} id={a.userId} size={compactNested ? "sm" : "md"} />
          <span className="font-medium text-slate-900">{a.userName}</span>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>{ACTIVITY_LABELS[a.activityType]}</span>
          <time dateTime={a.createdAt} title={formatTimestamp(a.createdAt)} className="ml-auto text-xs tabular-nums text-slate-500">
            {formatTime(a.createdAt)}
          </time>
        </div>
        {isMessage ? (
          <div
            id={`message-${a.message!.id}`}
            className={`mt-1.5 scroll-mt-6 scroll-mb-6 ${focused ? `${focusMessageWrap} px-2.5 py-2` : ""}`}
          >
            {a.message!.inReplyToAuthorName && (
              <div className="mb-1.5 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
                In reply to <span className="font-medium text-slate-700">{a.message!.inReplyToAuthorName}</span>
                {a.message!.inReplyToPreview ? (
                  <span className="text-slate-500">: {a.message!.inReplyToPreview}</span>
                ) : null}
              </div>
            )}
            {a.message!.recipientName && <div className="mb-1 text-xs text-slate-500">to {a.message!.recipientName}</div>}
            {a.message!.body ? (
              <div
                className={`whitespace-pre-wrap text-sm text-slate-800 ${
                  focused
                    ? "rounded border border-blue-400/80 bg-white px-3 py-2"
                    : compactNested
                      ? "border-l-2 border-slate-200 pl-2"
                      : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                }`}
              >
                {a.message!.body}
              </div>
            ) : null}
            <MessageAttachments attachments={a.message!.attachments} />
            {showReply && <ReplyButton activity={a} threadDepth={threadDepth} onReply={onReply} />}
          </div>
        ) : (
          <div className={`mt-1 text-sm text-slate-600 ${compactNested ? "text-xs" : ""}`}>
            {instruction ? a.description.replace(/: “[\s\S]*”$/, "") : a.description}
            {instruction && !compactNested && (
              <div
                className={`mt-1.5 whitespace-pre-wrap rounded-md px-3 py-2 text-sm text-slate-800 ${
                  focused
                    ? "border-2 border-blue-600 bg-blue-50/90 ring-1 ring-blue-500/30"
                    : "border border-violet-100 bg-violet-50/50"
                }`}
              >
                {instruction}
              </div>
            )}
            {instruction && compactNested && (
              <div className="mt-1 border-l-2 border-violet-200 pl-2 text-slate-800">“{instruction}”</div>
            )}
            {changes && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {Object.entries(changes).map(([field, c]) => (
                  <li key={field}>
                    {field}: <span className="line-through">{String(c.from ?? "—") || "—"}</span> → {String(c.to ?? "—") || "—"}
                  </li>
                ))}
              </ul>
            )}
            {showReply && <ReplyButton activity={a} threadDepth={threadDepth} onReply={onReply} />}
          </div>
        )}
        {threadAction && taskId && (
          <div className="mt-2">
            <AssignmentThreadCard taskId={taskId} action={threadAction} />
          </div>
        )}
      </div>
    </div>
  );
}

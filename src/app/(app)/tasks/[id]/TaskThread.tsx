"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { activityIdsAwaitingAck, activityIdsForAssignments } from "@/lib/awaiting-thread";
import { parseNotificationMark, parseTaskFocus, type TaskFocusTarget } from "@/lib/notification-link";
import { ActivityTimeline, type ReplyTarget } from "@/components/ActivityTimeline";
import type { AssignmentThreadAction } from "@/lib/assignment-thread";
import type { ActivityView } from "@/server/task-queries";
import { markNotificationReadForVisit } from "@/app/(app)/actions/notifications";
import { Composer } from "./Composer";

export function TaskThread({
  taskId,
  activities,
  assignmentActions,
  participants,
  users,
  canFollowUp,
  canMessage,
  locked,
  currentUserId,
  focusTarget: focusTargetProp = null,
  highlightFromNotification = false,
  assignments = [],
  myPendingAssignmentIds = [],
}: {
  taskId: number;
  activities: ActivityView[];
  assignments?: { id: number; status: string }[];
  myPendingAssignmentIds?: number[];
  assignmentActions: Record<number, AssignmentThreadAction>;
  participants: { id: number; name: string }[];
  users: { id: number; name: string }[];
  canFollowUp: boolean;
  canMessage: boolean;
  locked: boolean;
  currentUserId: number;
  focusTarget?: TaskFocusTarget | null;
  highlightFromNotification?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [threadFilter, setThreadFilter] = useState<"all" | "awaiting" | "mine">("all");
  const [notificationHighlight, setNotificationHighlight] = useState(highlightFromNotification);
  const [heldFocus, setHeldFocus] = useState<TaskFocusTarget | null>(() =>
    highlightFromNotification ? focusTargetProp : null,
  );
  const visitMarkRef = useRef<string | null>(null);

  useEffect(() => {
    const fromBell = searchParams.get("from") === "notification";
    const urlFocus = parseTaskFocus(searchParams.get("focus") ?? undefined);
    const notificationId = parseNotificationMark(searchParams.get("notificationId") ?? undefined);
    if (fromBell && urlFocus) {
      setHeldFocus(urlFocus);
      setNotificationHighlight(true);
      setThreadFilter("all");
    }
    if (fromBell) {
      const visitKey = `${notificationId ?? "none"}:${urlFocus ? `${urlFocus.kind}-${urlFocus.id}` : "none"}`;
      if (visitMarkRef.current !== visitKey) {
        visitMarkRef.current = visitKey;
        void markNotificationReadForVisit(taskId, {
          notificationId,
          focus: urlFocus,
          fromNotification: true,
        }).then(() => router.refresh());
      }
    }
    if (!fromBell) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("from");
    next.delete("focus");
    next.delete("notificationId");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams, taskId]);

  useEffect(() => {
    if (!notificationHighlight) return;
    const dismiss = () => setNotificationHighlight(false);
    const t = window.setTimeout(dismiss, 8000);
    window.addEventListener("pointerdown", dismiss, { once: true, capture: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", dismiss, { capture: true });
    };
  }, [notificationHighlight]);

  const focusTarget = notificationHighlight ? heldFocus : null;

  const awaitingCount = useMemo(
    () => activityIdsAwaitingAck(activities, assignments).size,
    [activities, assignments],
  );
  const myAwaitingCount = useMemo(
    () => activityIdsForAssignments(activities, new Set(myPendingAssignmentIds)).size,
    [activities, myPendingAssignmentIds],
  );

  const filteredActivities = useMemo(() => {
    if (threadFilter === "all") return activities;
    const ids =
      threadFilter === "mine"
        ? activityIdsForAssignments(activities, new Set(myPendingAssignmentIds))
        : activityIdsAwaitingAck(activities, assignments);
    if (ids.size === 0) return [];
    return activities.filter((a) => ids.has(a.id));
  }, [activities, assignments, myPendingAssignmentIds, threadFilter]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2">
        <span className="mr-1 text-xs font-medium text-slate-500">Show</span>
        {(
          [
            ["all", "All"],
            ["awaiting", `Awaiting (${awaitingCount})`],
            ["mine", `Needs my action (${myAwaitingCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              threadFilter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            } ${key === "awaiting" && awaitingCount === 0 ? "opacity-50" : ""} ${key === "mine" && myAwaitingCount === 0 ? "opacity-50" : ""}`}
            onClick={() => {
              setThreadFilter(key);
              setNotificationHighlight(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className="thread-scroll min-h-[12rem] min-w-0 max-h-[min(42rem,calc(100dvh-17.5rem))] overflow-y-auto overscroll-contain pr-0.5"
      >
        {threadFilter !== "all" && filteredActivities.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {threadFilter === "mine"
              ? "Nothing needs your acknowledgement right now."
              : "No assignments are waiting for a Received response."}
          </p>
        ) : (
          <ActivityTimeline
            activities={filteredActivities}
            taskId={taskId}
            assignmentActions={assignmentActions}
            currentUserId={currentUserId}
            onReply={(target) => {
              setNotificationHighlight(false);
              setReplyTo(target);
            }}
            focusTarget={focusTarget}
            highlightFromNotification={notificationHighlight}
            scrollContainerRef={scrollRef}
            allActivities={activities}
          />
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-slate-200 pt-3">
        {locked ? (
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
              <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" />
            </svg>
            This task is locked. Its history cannot change.
          </div>
        ) : (
          canMessage && (
            <Composer
              taskId={taskId}
              participants={participants}
              users={users}
              canFollowUp={canFollowUp}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          )
        )}
      </div>
    </div>
  );
}

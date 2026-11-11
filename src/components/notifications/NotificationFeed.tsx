"use client";

import { useState } from "react";
import type { NotificationView } from "@/server/notifications";
import { api } from "@/components/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import { notificationTaskHref } from "@/lib/notification-link";
import { dedupeNotifications, mergeNotifications } from "@/lib/notification-list";
import { NotificationLink } from "./NotificationControls";

export function NotificationFeed({
  items,
  onItemsChange,
  total,
  embedded = false,
  onNavigate,
  onUnreadChange,
}: {
  items: NotificationView[];
  onItemsChange: (next: NotificationView[] | ((prev: NotificationView[]) => NotificationView[])) => void;
  total: number;
  embedded?: boolean;
  onNavigate?: () => void;
  onUnreadChange?: (unread: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = dedupeNotifications(items);
  const hasMore = rows.length < total;

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ notifications: NotificationView[] }>(
        `/api/notifications?limit=${NOTIFICATION_PAGE_SIZE}&offset=${rows.length}`,
        undefined,
        "GET",
      );
      onItemsChange((prev) => mergeNotifications(prev, data.notifications));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500">You have no notifications yet.</p>;
  }

  return (
    <>
      <ul className={embedded ? "divide-y divide-slate-100" : "card divide-y divide-slate-100"}>
        {rows.map((n) => (
          <li key={n.id}>
            <NotificationLink
              id={n.id}
              href={notificationTaskHref(n)}
              unread={!n.isRead}
              onMarkedRead={(unreadLeft) => {
                if (!n.isRead) {
                  onItemsChange((prev) => prev.map((row) => (row.id === n.id ? { ...row, isRead: true } : row)));
                  if (typeof unreadLeft === "number") onUnreadChange?.(unreadLeft);
                  else
                    onUnreadChange?.(Math.max(0, rows.filter((row) => !row.isRead && row.id !== n.id).length));
                }
              }}
              onNavigate={onNavigate}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-blue-600"}`}
                  aria-label={n.isRead ? undefined : "Unread"}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm leading-snug ${n.isRead ? "text-slate-700" : "font-medium text-slate-900"}`}>
                    {n.title}
                  </div>
                  {n.taskId != null && (n.channelName || n.taskTitle) && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {n.channelName && (
                        <>
                          <span className="text-slate-400">Project </span>
                          <span className="font-medium text-slate-700">{n.channelName}</span>
                        </>
                      )}
                      <span className="text-slate-300"> · </span>
                      <span className="font-mono text-slate-500">#{n.taskId}</span>
                      {n.taskTitle && <span className="text-slate-700"> {n.taskTitle}</span>}
                      {n.taskStatusLabel && (
                        <>
                          <span className="text-slate-300"> · </span>
                          <span className="text-slate-500">{n.taskStatusLabel}</span>
                        </>
                      )}
                    </p>
                  )}
                  {n.body && n.body !== n.taskTitle && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{n.body}</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-slate-400" title={formatDateTime(n.createdAt)}>
                  {formatRelative(n.createdAt)}
                </time>
              </div>
            </NotificationLink>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className={`flex flex-col items-center gap-2 ${embedded ? "border-t border-slate-100 px-4 py-3" : "mt-4"}`}>
          <button type="button" className="btn-secondary w-full sm:w-auto" disabled={loading} onClick={() => void loadMore()}>
            {loading ? "Loading…" : "See more"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}

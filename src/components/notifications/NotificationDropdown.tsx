"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificationView } from "@/server/notifications";
import { api } from "@/components/api";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import { MarkAllRead } from "./NotificationControls";
import { dedupeNotifications } from "@/lib/notification-list";
import { NotificationFeed } from "./NotificationFeed";

export function NotificationDropdown({ unread }: { unread: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(unread);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelUnread = items.filter((n) => !n.isRead).length;

  useEffect(() => {
    setBadge(unread);
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{
      notifications: NotificationView[];
      total: number;
      unread: number;
    }>(`/api/notifications?limit=${NOTIFICATION_PAGE_SIZE}&offset=0`, undefined, "GET")
      .then((data) => {
        if (cancelled) return;
        setItems(dedupeNotifications(data.notifications));
        setTotal(data.total);
        if (typeof data.unread === "number") setBadge(data.unread);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function markAllReadLocal() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setBadge(0);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative rounded-full p-2 transition-colors ${open ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:bg-slate-100"}`}
        aria-label={`Notifications${badge ? ` (${badge} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M10 2a6 6 0 0 0-6 6v2.6l-1.4 2.8A1 1 0 0 0 3.5 15h13a1 1 0 0 0 .9-1.6L16 10.6V8a6 6 0 0 0-6-6Zm0 16a2.5 2.5 0 0 1-2.4-2h4.8A2.5 2.5 0 0 1 10 18Z" />
        </svg>
        {badge > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-50 flex w-[min(100vw-1.25rem,22.5rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
            {panelUnread > 0 && (
              <MarkAllRead
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                onSuccess={markAllReadLocal}
              />
            )}
          </div>
          <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : error && items.length === 0 ? (
              <p role="alert" className="px-4 py-8 text-center text-sm text-red-600">
                {error}
              </p>
            ) : (
              <NotificationFeed
                items={items}
                onItemsChange={setItems}
                total={total}
                embedded
                onNavigate={() => setOpen(false)}
                onUnreadChange={setBadge}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/actions/notifications";
import { api } from "@/components/api";

export function MarkAllRead({ onSuccess, className }: { onSuccess?: () => void; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className ?? "btn-secondary"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markAllNotificationsRead().catch(() => api("/api/notifications/read-all").catch(() => {}));
        onSuccess?.();
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all as read
    </button>
  );
}

export function NotificationLink({
  id,
  href,
  unread,
  onMarkedRead,
  onNavigate,
  children,
}: {
  id: number;
  href: string;
  unread: boolean;
  onMarkedRead?: (unreadLeft?: number) => void;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={`block px-3 py-2.5 hover:bg-slate-100 ${unread ? "bg-slate-100/80" : ""}`}
      onClick={async (e) => {
        e.preventDefault();
        let unreadLeft: number | undefined;
        if (unread) {
          try {
            const res = await markNotificationRead(id);
            unreadLeft = res.unread;
          } catch {
            try {
              const res = await api<{ ok: boolean; unread: number }>(`/api/notifications/${id}/read`, {});
              unreadLeft = res.unread;
            } catch {
              /* visit handler may still mark on task load */
            }
          }
          onMarkedRead?.(unreadLeft);
        }
        onNavigate?.();
        const dest = new URL(href, window.location.origin);
        const target = `${dest.pathname}${dest.search}${dest.hash}`;
        router.push(target);
        router.refresh();
      }}
    >
      {children}
    </a>
  );
}

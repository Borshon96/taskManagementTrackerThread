"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/notifications/read-all").catch(() => {});
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
  children,
}: {
  id: number;
  href: string;
  unread: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={`block px-4 py-3 hover:bg-slate-50 ${unread ? "bg-blue-50/30" : ""}`}
      onClick={async (e) => {
        e.preventDefault();
        if (unread) await api(`/api/notifications/${id}/read`).catch(() => {});
        router.push(href);
        router.refresh();
      }}
    >
      {children}
    </a>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ChannelListItem } from "@/server/channel-types";
import { useActiveChannel } from "./ActiveChannelContext";
import { api } from "./api";

export function ChannelSidebar({
  channels: initial,
  canCreateProjects = false,
}: {
  channels: ChannelListItem[];
  canCreateProjects?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [channels, setChannels] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { channelId: taskChannelId } = useActiveChannel();
  const onDashboard = pathname === "/";
  const activeId = (() => {
    const m = pathname.match(/^\/channels\/(\d+)/);
    if (m) return Number(m[1]);
    if (pathname.startsWith("/tasks/")) return taskChannelId;
    return null;
  })();

  async function createChannel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { channel } = await api<{ channel: { id: number; name: string; description: string; createdAt: string } }>(
        "/api/channels",
        { name: form.get("name"), description: form.get("description") ?? "" },
      );
      const next: ChannelListItem = { ...channel, taskCount: 0 };
      setChannels((list) => [...list, next].sort((a, b) => a.name.localeCompare(b.name)));
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      router.push(`/channels/${channel.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
  <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/95">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</span>
      {canCreateProjects && (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-2 py-1 text-xs" title="New project">
          +
        </button>
      )}
    </div>
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Projects">
      <ul className="mb-2 space-y-0.5 border-b border-slate-200 pb-2">
        <li>
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
              onDashboard ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="truncate">Dashboard</span>
          </Link>
        </li>
      </ul>
      {channels.length === 0 ? (
        <p className="px-2 py-3 text-xs text-slate-500">
          {canCreateProjects
            ? "No projects yet. Create one to organize tasks."
            : "No projects yet. Ask an admin to add you—then you can create tasks in that project."}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {channels.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <Link
                  href={`/channels/${c.id}`}
                  className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    active ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-700 hover:bg-white/80"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="truncate" title={c.name}>
                    {c.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-slate-400">{c.taskCount}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>

    {activeId !== null && (
      <div className="shrink-0 border-t border-slate-200 p-2">
        <Link href={`/tasks/new?channel=${activeId}`} className="btn-primary flex w-full justify-center py-2 text-xs">
          New task in this project
        </Link>
        {!canCreateProjects && (
          <p className="mt-1.5 px-1 text-center text-[10px] leading-snug text-slate-500">
            Any project member can create tasks here. Only admins can create new projects.
          </p>
        )}
      </div>
    )}

    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-channel-title">
        <div className="card w-full max-w-md p-5 shadow-xl">
          <h2 id="new-channel-title" className="text-base font-semibold">
            New project
          </h2>
          <p className="mt-1 text-sm text-slate-500">Tasks live inside a project channel. Team members can switch channels from this sidebar.</p>
          <form onSubmit={createChannel} className="mt-4 space-y-3">
            <div>
              <label htmlFor="channel-name" className="label">
                Name
              </label>
              <input id="channel-name" name="name" required maxLength={80} className="input" placeholder="Website relaunch" autoFocus />
            </div>
            <div>
              <label htmlFor="channel-desc" className="label">
                Description (optional)
              </label>
              <textarea id="channel-desc" name="description" rows={2} maxLength={2000} className="input" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </aside>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChannelMemberView } from "@/server/channel-types";
import { api } from "./api";
import { Avatar } from "./ui";

export function ChannelMembers({
  channelId,
  members: initial,
  invitees,
  currentUserId,
}: {
  channelId: number;
  members: ChannelMemberView[];
  invitees: { id: number; name: string; email: string }[];
  currentUserId: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMembers(initial);
  }, [initial]);

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setExpanded(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [expanded]);

  async function addMember(userId: number) {
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: ChannelMemberView[] }>(`/api/channels/${channelId}/members`, {
        userId,
      });
      setMembers(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: number) {
    if (!confirm("Remove this person from the project? They will lose access to its tasks.")) return;
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: ChannelMemberView[] }>(
        `/api/channels/${channelId}/members/${userId}`,
        undefined,
        "DELETE",
      );
      setMembers(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section ref={rootRef} className="card mb-5 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-900">Project members</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {members.length} member{members.length === 1 ? "" : "s"}
            {!expanded && invitees.length > 0 ? ` · ${invitees.length} can be added` : ""}
          </span>
        </div>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-slate-500">Only members can view tasks, post messages, and create work in this project.</p>
          {invitees.length > 0 && (
            <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">Add member</span>
              <select
                className="input max-w-[16rem] py-1.5 text-sm"
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) void addMember(id);
                  e.target.value = "";
                }}
              >
                <option value="">Choose user…</option>
                {invitees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={m.name} id={m.userId} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  </div>
                </div>
                {m.userId !== currentUserId && members.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-red-600"
                    disabled={busy}
                    onClick={() => void removeMember(m.userId)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

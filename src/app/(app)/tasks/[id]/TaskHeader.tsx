"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { AssigneeListInline } from "@/components/AssigneeList";
import { Avatar, PriorityBadge, StatusBadge, UserChip } from "@/components/ui";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority, type TaskStatus } from "@/lib/constants";
import { formatDate, formatDueDate } from "@/lib/format";
import type { TaskMemberView } from "@/server/task-members";
import type { ActiveAssigneeView } from "@/server/task-queries";

type TaskHeaderProps = {
  channelId: number;
  channelName: string;
  taskId: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdBy: number;
  creatorName: string;
  canEdit: boolean;
  locked: boolean;
  activeAssignees: ActiveAssigneeView[];
  assigneeName: string | null;
  taskMembers: TaskMemberView[];
  taskMemberInvitees: { id: number; name: string; email: string }[];
  canManageMembers: boolean;
  reopenedFrom: { id: number } | null;
  continuedAs: { id: number } | null;
};

export function TaskHeader(props: TaskHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(props.title);
  const [description, setDescription] = useState(props.description);
  const [priority, setPriority] = useState(props.priority);
  const [dueDate, setDueDate] = useState(props.dueDate ?? "");
  const [members, setMembers] = useState(props.taskMembers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showEdit = props.canEdit;

  function cancelEdit() {
    setTitle(props.title);
    setDescription(props.description);
    setPriority(props.priority);
    setDueDate(props.dueDate ?? "");
    setError(null);
    setEditing(false);
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tasks/${props.taskId}`, { title, description, priority, dueDate: dueDate || null }, "PATCH");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addMember(userId: number) {
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: TaskMemberView[] }>(`/api/tasks/${props.taskId}/members`, { userId });
      setMembers(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: number) {
    if (!confirm("Remove this person from the task? Their past messages will stay in the thread.")) return;
    setBusy(true);
    setError(null);
    try {
      const { members: next } = await api<{ members: TaskMemberView[] }>(
        `/api/tasks/${props.taskId}/members/${userId}`,
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
    <header className="relative rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="mb-1 text-xs text-slate-500">
        <span className="text-slate-400">Project: </span>
        <Link href={`/channels/${props.channelId}`} className="font-medium text-slate-800 hover:text-blue-700 hover:underline">
          {props.channelName}
        </Link>
      </p>
      {showEdit && !editing && (
        <button
          type="button"
          className="absolute right-3 top-2.5 text-xs font-medium text-blue-700 hover:text-blue-900"
          onClick={() => setEditing(true)}
        >
          Edit name &amp; details
        </button>
      )}

      {editing ? (
        <div className="space-y-2 pr-0 sm:pr-28">
          <div>
            <label htmlFor="hdr-title" className="sr-only">
              Title
            </label>
            <input
              id="hdr-title"
              className="input w-full text-base font-semibold sm:text-lg"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">#{props.taskId}</span>
            <StatusBadge status={props.status} />
            <label htmlFor="hdr-priority" className="sr-only">
              Priority
            </label>
            <select
              id="hdr-priority"
              className="input py-0.5 text-xs"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <label htmlFor="hdr-due" className="sr-only">
              Due date
            </label>
            <input id="hdr-due" type="date" className="input py-0.5 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <label htmlFor="hdr-desc" className="sr-only">
            Description
          </label>
          <textarea
            id="hdr-desc"
            className="input w-full text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" disabled={busy || !title.trim()} onClick={() => void saveEdit()}>
              Save
            </button>
            <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="pr-24 text-base font-semibold leading-snug text-slate-900 sm:text-lg">{props.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">#{props.taskId}</span>
            <StatusBadge status={props.status} />
            {props.priority !== "normal" && <PriorityBadge priority={props.priority} />}
          </div>
          {props.description ? (
            <p className="mt-2 whitespace-pre-wrap border-t border-slate-100 pt-2 text-sm leading-relaxed text-slate-700">
              {props.description}
            </p>
          ) : null}
        </>
      )}

      <div
        className={`flex flex-col gap-2 text-xs text-slate-600 ${editing ? "mt-2 border-t border-slate-100 pt-2" : props.description ? "mt-2" : "mt-1.5"}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="text-slate-400">Created by </span>
            <UserChip name={props.creatorName} id={props.createdBy} />
          </span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span>
            <span className="text-slate-400">Assigned: </span>
            <AssigneeListInline assignees={props.activeAssignees} fallbackName={props.assigneeName} />
          </span>
          {props.dueDate && !props.completedAt && (
            <>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>
                <span className="text-slate-400">Due </span>
                {formatDueDate(props.dueDate)}
              </span>
            </>
          )}
          {props.completedAt && (
            <>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span className="text-emerald-700">Completed {formatDate(props.completedAt)}</span>
            </>
          )}
        </div>

        {(members.length > 0 || props.canManageMembers) && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-slate-100 pt-2">
            <span className="shrink-0 text-slate-400">On this task:</span>
            <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-1.5"
                >
                  <Avatar name={m.name} id={m.userId} size="sm" />
                  <span className="max-w-[8rem] truncate text-xs font-medium text-slate-800">
                    {m.name}
                    {m.userId === props.createdBy && <span className="font-normal text-slate-500"> · creator</span>}
                    {m.role === "admin" && m.userId !== props.createdBy && (
                      <span className="font-normal text-slate-500"> · admin</span>
                    )}
                  </span>
                  {props.canManageMembers && m.userId !== props.createdBy && m.role !== "admin" && (
                    <button
                      type="button"
                      className="ml-0.5 rounded px-1 text-[10px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={busy}
                      title={`Remove ${m.name}`}
                      onClick={() => void removeMember(m.userId)}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {props.canManageMembers && props.taskMemberInvitees.length > 0 && (
              <select
                className="input max-w-[11rem] shrink-0 py-1 text-xs"
                defaultValue=""
                disabled={busy}
                aria-label="Add person to task"
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id > 0) {
                    void addMember(id);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">+ Add person</option>
                {props.taskMemberInvitees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {(props.reopenedFrom || props.continuedAs) && (
        <p className="mt-1 text-xs text-slate-600">
          {props.reopenedFrom && (
            <>
              From{" "}
              <Link href={`/tasks/${props.reopenedFrom.id}`} className="font-medium text-blue-700 hover:underline">
                #{props.reopenedFrom.id}
              </Link>
            </>
          )}
          {props.continuedAs && (
            <>
              {props.reopenedFrom ? " · " : ""}
              Continues as{" "}
              <Link href={`/tasks/${props.continuedAs.id}`} className="font-medium text-blue-700 hover:underline">
                #{props.continuedAs.id}
              </Link>
            </>
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </header>
  );
}

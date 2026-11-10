import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type AssignmentStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants";
import { initials } from "@/lib/format";

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: "bg-slate-100 text-slate-700 ring-slate-200",
  assigned: "bg-blue-50 text-blue-700 ring-blue-200",
  reassigned: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  received: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-200",
  waiting: "bg-orange-50 text-orange-800 ring-orange-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ASSIGNMENT_STYLES: Record<AssignmentStatus, string> = {
  pending: "bg-blue-50 text-blue-700 ring-blue-200",
  received: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  not_received: "bg-rose-50 text-rose-700 ring-rose-200",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  superseded: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

const badgeBase = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${badgeBase} ${STATUS_STYLES[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <span className={`${badgeBase} ${ASSIGNMENT_STYLES[status]}`}>{ASSIGNMENT_STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "normal") return <span className="text-xs text-slate-500">Normal</span>;
  const style = priority === "high" ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-500 ring-slate-200";
  return <span className={`${badgeBase} ${style}`}>{PRIORITY_LABELS[priority]}</span>;
}

const AVATAR_COLORS = [
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

export function Avatar({ name, id, size = "sm" }: { name: string | null; id?: number | null; size?: "sm" | "md" }) {
  const color = AVATAR_COLORS[(id ?? 0) % AVATAR_COLORS.length];
  const dims = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${name ? color : "bg-slate-100 text-slate-400"}`}
    >
      {initials(name)}
    </span>
  );
}

export function UserChip({ name, id }: { name: string | null; id?: number | null }) {
  if (!name) return <span className="text-slate-400">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar name={name} id={id} />
      <span>{name}</span>
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

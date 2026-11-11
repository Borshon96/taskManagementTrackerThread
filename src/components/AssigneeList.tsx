import type { ActiveAssigneeView } from "@/server/task-queries";
import { Avatar, UserChip } from "./ui";

const TABLE_ASSIGNEE_PREVIEW = 2;

export function AssigneeList({
  assignees,
  fallbackName,
  fallbackId,
}: {
  assignees: ActiveAssigneeView[];
  fallbackName: string | null;
  fallbackId: number | null;
}) {
  if (assignees.length > 0) {
    return (
      <ul className="flex flex-col gap-1.5">
        {assignees.map((a) => (
          <li key={a.assignmentId} className="flex flex-wrap items-center gap-1.5">
            <UserChip name={a.name} id={a.userId} />
            {a.assignmentType === "follow_up" ? (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">Follow-up</span>
            ) : (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">Main</span>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return <UserChip name={fallbackName} id={fallbackId} />;
}

/** One-line assignee summary for compact headers. */
export function AssigneeListInline({
  assignees,
  fallbackName,
}: {
  assignees: ActiveAssigneeView[];
  fallbackName: string | null;
}) {
  if (assignees.length === 0) {
    return <span className="text-slate-500">{fallbackName ?? "Unassigned"}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {assignees.map((a, i) => (
        <span key={a.assignmentId} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="text-slate-300" aria-hidden>, </span>}
          <span className="text-slate-800">{a.name}</span>
          {assignees.length > 1 && (
            <span
              className={`rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${
                a.assignmentType === "primary" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
              }`}
            >
              {a.assignmentType === "primary" ? "main" : "f/u"}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function AssigneeListCompact({
  idsCsv,
  namesCsv,
  fallbackName,
  fallbackId,
}: {
  idsCsv: string | null;
  namesCsv: string | null;
  fallbackName: string | null;
  fallbackId: number | null;
}) {
  const ids = idsCsv?.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0) ?? [];
  const names = namesCsv?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const people: { id: number; name: string }[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    if (seen.has(id)) continue;
    seen.add(id);
    people.push({ id, name: names[i] ?? `User #${id}` });
  }
  if (people.length === 0) {
    return <UserChip name={fallbackName} id={fallbackId} />;
  }
  if (people.length === 1) {
    return <UserChip name={people[0]!.name ?? fallbackName} id={people[0]!.id} />;
  }
  const preview = people.slice(0, TABLE_ASSIGNEE_PREVIEW);
  const extra = people.length - preview.length;
  const hoverTitle = people.map((p) => p.name).join(", ");

  return (
    <span className="inline-flex max-w-[13rem] items-center gap-1.5 whitespace-nowrap" title={hoverTitle}>
      {preview.map((p, i) => (
        <span key={`${p.id}-${i}`} className="inline-flex min-w-0 items-center gap-1">
          <Avatar name={p.name} id={p.id} size="sm" />
          <span className="max-w-[4.25rem] truncate text-xs text-slate-800 sm:max-w-[5.5rem]">{p.name}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600" title={hoverTitle}>
          +{extra} more
        </span>
      )}
    </span>
  );
}

import { formatDateTime } from "@/lib/format";
import type { AssignmentView } from "@/server/task-queries";
import { AssignmentStatusBadge, Avatar } from "./ui";

export function AssignmentChain({
  creator,
  createdAt,
  assignments,
}: {
  creator: { id: number; name: string };
  createdAt: string;
  assignments: AssignmentView[];
}) {
  return (
    <ol className="text-sm">
      <li className="flex items-start gap-2">
        <Avatar name={creator.name} id={creator.id} size="md" />
        <div className="min-w-0">
          <div className="font-medium">{creator.name}</div>
          <div className="text-xs text-slate-500">Created · {formatDateTime(createdAt)}</div>
        </div>
      </li>
      {assignments.map((a) => {
        const followUp = a.assignmentType === "follow_up";
        return (
          <li key={a.id} className={followUp ? "ml-5" : ""} data-assignment-id={a.id}>
            <div className="my-1 ml-3.5 flex items-start gap-2 border-l-2 border-dashed border-slate-200 py-1 pl-4 text-xs text-slate-500">
              <span aria-hidden>↓</span>
              <span>
                <span className="block">
                  {followUp ? "Follow-up" : "Assigned"} by {a.assignedByName}
                </span>
                <span className="block whitespace-nowrap">{formatDateTime(a.assignedAt)}</span>
              </span>
            </div>
            <div className={`flex items-start gap-2 ${a.status === "superseded" || a.status === "cancelled" ? "opacity-60" : ""}`}>
              <Avatar name={a.assignedToName} id={a.assignedTo} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.assignedToName}</span>
                  {followUp && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">Follow-up</span>}
                  <AssignmentStatusBadge status={a.status} />
                </div>
                {a.instruction && <div className="mt-0.5 text-xs italic text-slate-600">“{a.instruction}”</div>}
                <dl className="mt-0.5 space-y-0.5 text-xs text-slate-500">
                  <div>
                    <dt className="inline">Received: </dt>
                    <dd className="inline">{a.receivedAt ? formatDateTime(a.receivedAt) : "Not yet"}</dd>
                  </div>
                  {a.completedAt && (
                    <div>
                      <dt className="inline">Completed: </dt>
                      <dd className="inline">{formatDateTime(a.completedAt)}</dd>
                    </div>
                  )}
                </dl>
                {followUp && a.status === "completed" && (
                  <div className="mt-1 text-xs text-slate-500">↩ Returned to {a.assignedByName}</div>
                )}
              </div>
            </div>
          </li>
        );
      })}
      {assignments.length === 0 && <li className="mt-2 text-xs text-slate-500">Not assigned yet.</li>}
    </ol>
  );
}

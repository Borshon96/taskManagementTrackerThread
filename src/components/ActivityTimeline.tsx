import { ACTIVITY_LABELS, type ActivityType } from "@/lib/constants";
import { formatDate, formatTime, formatTimestamp } from "@/lib/format";
import type { ActivityView } from "@/server/task-queries";
import { Avatar } from "./ui";

type Tone = { dot: string; chip: string };

const TONES: Record<string, Tone> = {
  neutral: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
  assign: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  received: { dot: "bg-cyan-500", chip: "bg-cyan-50 text-cyan-800" },
  negative: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700" },
  status: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  message: { dot: "bg-white ring-2 ring-slate-300", chip: "bg-slate-100 text-slate-600" },
  followUp: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  done: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
};

const TYPE_TONE: Record<ActivityType, keyof typeof TONES> = {
  task_created: "neutral",
  task_updated: "neutral",
  task_assigned: "assign",
  task_reassigned: "assign",
  task_received: "received",
  task_not_received: "negative",
  status_changed: "status",
  message_added: "message",
  follow_up_assigned: "followUp",
  follow_up_received: "followUp",
  follow_up_not_received: "negative",
  follow_up_in_progress: "followUp",
  follow_up_completed: "followUp",
  task_completed: "done",
  task_cancelled: "negative",
};

export function ActivityTimeline({ activities }: { activities: ActivityView[] }) {
  const groups: { day: string; items: ActivityView[] }[] = [];
  for (const a of activities) {
    const day = formatDate(a.createdAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(a);
  }

  return (
    <ol className="space-y-5">
      {groups.map((g) => (
        <li key={g.day}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.day}</div>
          <ol className="relative border-l border-slate-200 pl-5">
            {g.items.map((a) => (
              <TimelineItem key={a.id} activity={a} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function TimelineItem({ activity: a }: { activity: ActivityView }) {
  const tone = TONES[TYPE_TONE[a.activityType]];
  const isMessage = a.activityType === "message_added" && a.message;
  const instruction =
    a.activityType === "follow_up_assigned" || a.activityType === "task_assigned" || a.activityType === "task_reassigned"
      ? (a.metadata.instruction as string | null | undefined)
      : null;
  const changes =
    a.activityType === "task_updated"
      ? (a.metadata.changes as Record<string, { from: unknown; to: unknown }> | undefined)
      : undefined;

  return (
    <li className="relative pb-4 last:pb-0" data-activity-type={a.activityType}>
      <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Avatar name={a.userName} id={a.userId} />
        <span className="font-medium text-slate-900">{a.userName}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>{ACTIVITY_LABELS[a.activityType]}</span>
        <time dateTime={a.createdAt} title={formatTimestamp(a.createdAt)} className="ml-auto text-xs tabular-nums text-slate-500">
          {formatTime(a.createdAt)}
        </time>
      </div>
      {isMessage ? (
        <div className="mt-1.5 ml-8">
          {a.message!.recipientName && <div className="mb-1 text-xs text-slate-500">to {a.message!.recipientName}</div>}
          <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {a.message!.body}
          </div>
        </div>
      ) : (
        <div className="ml-8 mt-0.5 text-sm text-slate-600">
          {instruction ? a.description.replace(/: “[\s\S]*”$/, "") : a.description}
          {instruction && (
            <div className="mt-1.5 whitespace-pre-wrap rounded-md border border-violet-100 bg-violet-50/50 px-3 py-2 text-sm text-slate-800">
              {instruction}
            </div>
          )}
          {changes && (
            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
              {Object.entries(changes).map(([field, c]) => (
                <li key={field}>
                  {field}: <span className="line-through">{String(c.from ?? "—") || "—"}</span> → {String(c.to ?? "—") || "—"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

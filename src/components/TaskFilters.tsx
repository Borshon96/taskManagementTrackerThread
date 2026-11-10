import Link from "next/link";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import type { TaskFilters as Filters } from "@/server/task-queries";

const VIEW_LABELS: Record<string, string> = {
  all: "All visible tasks",
  mine: "My tasks",
  my_open: "My open tasks",
  assigned: "Assigned to me",
  created: "Created by me",
  pending_ack: "Pending acknowledgement",
  in_progress: "In progress",
  completed: "Completed",
};

export function TaskFilters({
  filters,
  users,
  isAdmin,
}: {
  filters: Filters;
  users: { id: number; name: string }[];
  isAdmin: boolean;
}) {
  const active =
    filters.q || filters.status || filters.assigneeId || filters.creatorId || filters.from || filters.to || filters.view !== "all";
  return (
    <form method="get" className="card mb-4 grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-[2fr_repeat(6,1fr)_auto]">
      <div className="col-span-2 sm:col-span-3 lg:col-span-1">
        <label htmlFor="q" className="label">
          Search
        </label>
        <input id="q" name="q" defaultValue={filters.q} placeholder="Title or task ID (e.g. 1001)" className="input" />
      </div>
      <div>
        <label htmlFor="view" className="label">
          Show
        </label>
        <select id="view" name="view" defaultValue={filters.view ?? "all"} className="input">
          {Object.entries(VIEW_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {isAdmin && value === "my_open" ? "All open tasks" : isAdmin && value === "all" ? "All tasks" : label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status" className="label">
          Status
        </label>
        <select id="status" name="status" defaultValue={filters.status ?? ""} className="input">
          <option value="">Any status</option>
          <option value="open">Any open</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assignee" className="label">
          Assignee
        </label>
        <select id="assignee" name="assignee" defaultValue={filters.assigneeId ?? ""} className="input">
          <option value="">Anyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="creator" className="label">
          Creator
        </label>
        <select id="creator" name="creator" defaultValue={filters.creatorId ?? ""} className="input">
          <option value="">Anyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="from" className="label">
          Created from
        </label>
        <input id="from" name="from" type="date" defaultValue={filters.from} className="input" />
      </div>
      <div>
        <label htmlFor="to" className="label">
          Created to
        </label>
        <input id="to" name="to" type="date" defaultValue={filters.to} className="input" />
      </div>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
        <button type="submit" className="btn-primary">
          Apply
        </button>
        {active && (
          <Link href="/" className="btn-secondary">
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}

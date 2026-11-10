import { TASK_VIEWS, type TaskFilters, type TaskView } from "./task-queries";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

function positiveInt(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function parseTaskFilters(params: Params): TaskFilters {
  const view = get(params, "view");
  return {
    q: get(params, "q"),
    status: get(params, "status"),
    assigneeId: positiveInt(get(params, "assignee")),
    creatorId: positiveInt(get(params, "creator")),
    from: get(params, "from"),
    to: get(params, "to"),
    view: TASK_VIEWS.includes(view as TaskView) ? (view as TaskView) : "all",
    page: positiveInt(get(params, "page")),
  };
}

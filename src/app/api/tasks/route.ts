import { parseTaskFilters } from "@/server/filters";
import { readJson, route } from "@/server/http";
import { listTasks } from "@/server/task-queries";
import { createTask } from "@/server/tasks";

export const GET = route(({ req, user }) => listTasks(user, parseTaskFilters(req.nextUrl.searchParams)));

export const POST = route(async ({ req, user }) => ({ task: createTask(user, await readJson(req)) }));

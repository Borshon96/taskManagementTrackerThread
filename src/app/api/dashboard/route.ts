import { route } from "@/server/http";
import { dashboardCounts } from "@/server/task-queries";

export const GET = route(({ user }) => ({ counts: dashboardCounts(user) }));

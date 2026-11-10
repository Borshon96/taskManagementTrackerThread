import { route } from "@/server/http";

export const GET = route(({ user }) => ({ user }));

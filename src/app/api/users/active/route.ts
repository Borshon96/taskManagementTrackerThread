import { route } from "@/server/http";
import { listActiveUsers } from "@/server/users";

export const GET = route(() => ({ users: listActiveUsers() }));

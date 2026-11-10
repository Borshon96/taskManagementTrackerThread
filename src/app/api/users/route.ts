import { readJson, route } from "@/server/http";
import { createUser, listUsers } from "@/server/users";

export const GET = route(({ user }) => ({ users: listUsers(user) }), { admin: true });

export const POST = route(async ({ req, user }) => ({ user: await createUser(user, await readJson(req)) }), {
  admin: true,
});

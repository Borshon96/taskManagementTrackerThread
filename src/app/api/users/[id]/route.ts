import { intParam, readJson, route } from "@/server/http";
import { deleteUser, updateUser } from "@/server/users";

export const PATCH = route<{ id: string }>(
  async ({ req, user, params }) => ({ user: await updateUser(user, intParam(params.id), await readJson(req)) }),
  { admin: true },
);

export const DELETE = route<{ id: string }>(
  ({ user, params }) => deleteUser(user, intParam(params.id)),
  { admin: true },
);

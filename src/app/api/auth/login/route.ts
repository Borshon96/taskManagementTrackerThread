import { NextResponse } from "next/server";
import { z } from "zod";
import { login, SESSION_COOKIE } from "@/server/auth";
import { readJson, route } from "@/server/http";
import { sessionCookieOptions } from "@/server/session";
import { parse } from "@/server/users";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const POST = route(
  async ({ req }) => {
    const { email, password } = parse(schema, await readJson(req));
    const session = await login(email, password);
    const res = NextResponse.json({ user: session.user });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  },
  { public: true },
);

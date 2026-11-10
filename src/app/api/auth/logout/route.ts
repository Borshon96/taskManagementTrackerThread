import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/server/auth";
import { route } from "@/server/http";
import { sessionCookieOptions } from "@/server/session";

export const POST = route(
  ({ req }) => {
    destroySession(req.cookies.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
    return res;
  },
  { public: true },
);

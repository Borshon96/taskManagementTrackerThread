import { NextResponse, type NextRequest } from "next/server";
import { AppError, badRequest, forbidden, unauthorized } from "@/lib/errors";
import { SESSION_COOKIE, userForSessionToken, type SessionUser } from "./auth";

type Ctx<P> = { params: Promise<P> };

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Request body must be JSON");
  }
}

export function intParam(value: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid id");
  return n;
}

export function route<P = Record<string, string>>(
  fn: (args: { req: NextRequest; user: SessionUser; params: P }) => unknown | Promise<unknown>,
  options: { admin?: boolean; public?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) throw forbidden("Cross-origin request rejected");
      const user = userForSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (!user && !options.public) throw unauthorized();
      if (options.admin && user?.role !== "admin") throw forbidden();
      const params = (await ctx.params) as P;
      const result = await fn({ req, user: user as SessionUser, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

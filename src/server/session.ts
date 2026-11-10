import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_TTL_MS, userForSessionToken, type SessionUser } from "./auth";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return userForSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "admin") notFound();
  return user;
}

export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expires ?? new Date(Date.now() + SESSION_TTL_MS),
  };
}

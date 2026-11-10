import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { unauthorized } from "@/lib/errors";

export const SESSION_COOKIE = "tt_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function tooManyFailures(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > FAILURE_WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > FAILURE_WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export async function login(email: string, password: string) {
  const db = getDb();
  const key = email.trim().toLowerCase();
  if (tooManyFailures(key)) throw unauthorized("Too many failed attempts. Try again in a few minutes.");

  const user = db.select().from(users).where(eq(users.email, key)).get();
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    recordFailure(key);
    throw unauthorized("Invalid email or password");
  }
  failures.delete(key);

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
  db.insert(sessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: expiresAt.toISOString() }).run();
  return { token, expiresAt, user: toSessionUser(user) };
}

export function userForSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const row = getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .get();
  if (!row || !row.user.isActive) return null;
  return toSessionUser(row.user);
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
}

export function destroyUserSessions(userId: number) {
  getDb().delete(sessions).where(eq(sessions.userId, userId)).run();
}

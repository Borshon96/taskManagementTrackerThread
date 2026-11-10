import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { USER_ROLES, users, type User } from "@/db/schema";
import { nowIso } from "@/lib/clock";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { destroyUserSessions, hashPassword, type SessionUser } from "./auth";
import { purgeUserAndLinkedData, type UserDeleteSummary } from "./user-delete";

export type PublicUser = Omit<User, "passwordHash">;

const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(USER_ROLES).default("user"),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.email("Enter a valid email").trim().toLowerCase().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional().or(z.literal("")),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? "Invalid input");
  return result.data;
}

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
}

export function listUsers(actor: SessionUser): PublicUser[] {
  requireAdmin(actor);
  return getDb().select(publicColumns).from(users).orderBy(asc(users.name)).all();
}

export function listActiveUsers() {
  return getDb()
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name))
    .all();
}

export function listAllUserNames() {
  return getDb().select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)).all();
}

function emailTaken(email: string, exceptId?: number) {
  const where = exceptId ? and(eq(users.email, email), ne(users.id, exceptId)) : eq(users.email, email);
  return !!getDb().select({ id: users.id }).from(users).where(where).get();
}

export async function createUser(actor: SessionUser, input: unknown): Promise<PublicUser> {
  requireAdmin(actor);
  const data = parse(createUserSchema, input);
  if (emailTaken(data.email)) throw conflict("A user with that email already exists");
  const ts = nowIso();
  return getDb()
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning(publicColumns)
    .get();
}

export async function updateUser(actor: SessionUser, id: number, input: unknown): Promise<PublicUser> {
  requireAdmin(actor);
  const data = parse(updateUserSchema, input);
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.id, id)).get();
  if (!existing) throw notFound("User not found");
  if (data.email && emailTaken(data.email, id)) throw conflict("A user with that email already exists");
  if (id === actor.id && (data.isActive === false || data.role === "user")) {
    throw badRequest("You cannot deactivate or demote your own account");
  }

  const losesAdmin =
    existing.role === "admin" && existing.isActive && (data.role === "user" || data.isActive === false);
  if (losesAdmin) {
    const otherAdmins = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, id)))
      .all();
    if (otherAdmins.length === 0) throw badRequest("At least one active admin is required");
  }

  const updated = db
    .update(users)
    .set({
      name: data.name ?? existing.name,
      email: data.email ?? existing.email,
      role: data.role ?? existing.role,
      isActive: data.isActive ?? existing.isActive,
      passwordHash: data.password ? await hashPassword(data.password) : existing.passwordHash,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, id))
    .returning(publicColumns)
    .get();

  if (data.isActive === false || data.password) destroyUserSessions(id);
  return updated;
}

export function deleteUser(actor: SessionUser, id: number): UserDeleteSummary {
  requireAdmin(actor);
  if (id === actor.id) throw badRequest("You cannot delete your own account");

  const db = getDb();
  const existing = db.select().from(users).where(eq(users.id, id)).get();
  if (!existing) throw notFound("User not found");

  if (existing.role === "admin" && existing.isActive) {
    const otherAdmins = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, id)))
      .all();
    if (otherAdmins.length === 0) throw badRequest("At least one active admin is required");
  }

  destroyUserSessions(id);
  return purgeUserAndLinkedData(db, id);
}

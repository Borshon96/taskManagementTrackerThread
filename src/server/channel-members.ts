import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { channelMembers, tasks, users } from "@/db/schema";
import { nowIso } from "@/lib/clock";
import { badRequest, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";
import { assertCanManageMembers, assertChannelMember, isChannelMember, type Tx } from "./channel-access";
import { ensureTaskMember } from "./task-core";
import type { ChannelMemberView } from "./channel-types";
import { parse } from "./users";

const memberSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export function insertChannelMemberRow(tx: Tx, channelId: number, userId: number, addedBy: number, at: string) {
  const user = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!user) throw badRequest("User does not exist");
  tx.insert(channelMembers).values({ channelId, userId, addedBy, createdAt: at }).run();
}

export function listChannelMembers(actor: SessionUser, channelId: number): ChannelMemberView[] {
  const db = getDb();
  assertChannelMember(db, actor, channelId);
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      addedAt: channelMembers.createdAt,
    })
    .from(channelMembers)
    .innerJoin(users, eq(users.id, channelMembers.userId))
    .where(eq(channelMembers.channelId, channelId))
    .orderBy(asc(users.name))
    .all()
    .map((m) => ({
      userId: Number(m.userId),
      name: String(m.name),
      email: String(m.email),
      addedAt: String(m.addedAt),
    }));
}

export function listChannelMemberIds(tx: Tx, channelId: number) {
  return tx
    .select({ userId: channelMembers.userId })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId))
    .all()
    .map((r) => r.userId);
}

export function addChannelMember(actor: SessionUser, channelId: number, input: unknown) {
  const { userId } = parse(memberSchema, input);
  const at = nowIso();
  getDb().transaction((tx) => {
    assertCanManageMembers(tx, actor, channelId);
    if (isChannelMember(tx, userId, channelId)) throw badRequest("User is already in this project");
    insertChannelMemberRow(tx, channelId, userId, actor.id, at);
    const taskRows = tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.channelId, channelId)).all();
    for (const { id: taskId } of taskRows) {
      ensureTaskMember(tx, taskId, userId, actor.id, at);
    }
  });
  return listChannelMembers(actor, channelId);
}

export function removeChannelMember(actor: SessionUser, channelId: number, userId: number) {
  getDb().transaction((tx) => {
    assertCanManageMembers(tx, actor, channelId);
    const count =
      tx
        .select({ n: sql<number>`count(*)` })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId))
        .get()?.n ?? 0;
    if (count <= 1) throw badRequest("A project must keep at least one member");
    const removed = tx
      .delete(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
      .returning()
      .get();
    if (!removed) throw notFound("Member not found");
  });
  return listChannelMembers(actor, channelId);
}

export function listInvitableUsers(actor: SessionUser, channelId: number) {
  const db = getDb();
  assertChannelMember(db, actor, channelId);
  const memberIds = listChannelMemberIds(db, channelId);
  const notIn = memberIds.length ? notInArray(users.id, memberIds) : undefined;
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(memberIds.length ? and(eq(users.isActive, true), notIn) : eq(users.isActive, true))
    .orderBy(asc(users.name))
    .all()
    .map((u) => ({ id: Number(u.id), name: String(u.name), email: String(u.email) }));
}

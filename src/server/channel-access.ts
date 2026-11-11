import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { channelMembers } from "@/db/schema";
import { badRequest, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";

export type Tx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export function isChannelMember(tx: Tx, userId: number, channelId: number) {
  return !!tx
    .select({ id: channelMembers.id })
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
    .get();
}

/** Hidden projects report as not found. */
export function assertChannelMember(tx: Tx, actor: SessionUser, channelId: number) {
  if (!isChannelMember(tx, actor.id, channelId)) throw notFound("Channel not found");
}

export function assertAssigneeInChannel(tx: Tx, channelId: number, assigneeId: number) {
  if (!isChannelMember(tx, assigneeId, channelId)) {
    throw badRequest("That user must be added to the project before they can receive work");
  }
}

export function assertCanManageMembers(tx: Tx, actor: SessionUser, channelId: number) {
  assertChannelMember(tx, actor, channelId);
}

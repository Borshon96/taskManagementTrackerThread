import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { channelMembers, channels } from "@/db/schema";
import { nowIso } from "@/lib/clock";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "./auth";
import { assertChannelMember } from "./channel-access";
import { insertChannelMemberRow } from "./channel-members";
import type { ChannelListItem } from "./channel-types";
import { parse } from "./users";

export type { ChannelListItem, ChannelMemberView } from "./channel-types";
export {
  addChannelMember,
  listChannelMemberIds,
  listChannelMembers,
  listInvitableUsers,
  removeChannelMember,
} from "./channel-members";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(2000).optional().default(""),
});

export function listChannels(actor: SessionUser): ChannelListItem[] {
  const db = getDb();
  const rows = db.all<ChannelListItem>(sql`
    SELECT
      c.id,
      c.name,
      c.description,
      c.created_at AS createdAt,
      (SELECT COUNT(*) FROM tasks t WHERE t.channel_id = c.id) AS taskCount
    FROM channels c
    INNER JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ${actor.id}
    ORDER BY c.name ASC, c.id ASC
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    description: String(r.description),
    createdAt: String(r.createdAt),
    taskCount: Number(r.taskCount),
  }));
}

export function getChannel(actor: SessionUser, channelId: number) {
  const db = getDb();
  assertChannelMember(db, actor, channelId);
  const row = db.select().from(channels).where(eq(channels.id, channelId)).get();
  if (!row) throw notFound("Channel not found");
  return row;
}

export function defaultChannelId(actor: SessionUser): number {
  const db = getDb();
  const row = db
    .select({ id: channels.id })
    .from(channels)
    .innerJoin(channelMembers, and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, actor.id)))
    .orderBy(asc(channels.name), asc(channels.id))
    .limit(1)
    .get();
  if (!row) throw badRequest("You are not a member of any project. Ask an admin to invite you to one.");
  return row.id;
}

export function createChannel(actor: SessionUser, input: unknown) {
  if (actor.role !== "admin") throw forbidden("Only admins can create projects. You can still create tasks inside projects you belong to.");
  const data = parse(createSchema, input);
  const at = nowIso();
  return getDb().transaction((tx) => {
    const channel = tx
      .insert(channels)
      .values({
        name: data.name,
        description: data.description,
        createdBy: actor.id,
        createdAt: at,
        updatedAt: at,
      })
      .returning()
      .get();
    insertChannelMemberRow(tx, channel.id, actor.id, actor.id, at);
    return channel;
  });
}

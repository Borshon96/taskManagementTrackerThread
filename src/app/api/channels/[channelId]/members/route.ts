import { intParam, readJson, route } from "@/server/http";
import { addChannelMember, listChannelMembers, listInvitableUsers } from "@/server/channel-members";

type P = { channelId: string };

export const GET = route<P>(({ user, params }) => {
  const channelId = intParam(params.channelId);
  return { members: listChannelMembers(user, channelId), invitees: listInvitableUsers(user, channelId) };
});

export const POST = route<P>(async ({ req, user, params }) => ({
  members: addChannelMember(user, intParam(params.channelId), await readJson(req)),
}));

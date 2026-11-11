import { intParam, route } from "@/server/http";
import { removeChannelMember } from "@/server/channel-members";

type P = { channelId: string; userId: string };

export const DELETE = route<P>(({ user, params }) => ({
  members: removeChannelMember(user, intParam(params.channelId), intParam(params.userId)),
}));

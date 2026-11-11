import { readJson, route } from "@/server/http";
import { createChannel, listChannels } from "@/server/channels";

export const GET = route(({ user }) => ({ channels: listChannels(user) }));

export const POST = route(async ({ req, user }) => {
  const channel = createChannel(user, await readJson(req));
  return {
    channel: {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      createdAt: channel.createdAt,
    },
  };
});

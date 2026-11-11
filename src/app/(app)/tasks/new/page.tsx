import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { defaultChannelId, getChannel, listChannelMembers } from "@/server/channels";
import { requirePageUser } from "@/server/session";
import { listActiveUsers } from "@/server/users";
import { SyncTaskChannel } from "@/components/ActiveChannelContext";
import { NewTaskForm } from "./NewTaskForm";

export const metadata = { title: "New Task · Task Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser();
  const channelParam = (await searchParams).channel;
  let channelId = Number(Array.isArray(channelParam) ? channelParam[0] : channelParam);
  if (!Number.isInteger(channelId) || channelId <= 0) {
    try {
      redirect(`/tasks/new?channel=${defaultChannelId(user)}`);
    } catch (err) {
      if (err instanceof AppError && err.status === 400) notFound();
      throw err;
    }
  }
  try {
    getChannel(user, channelId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const memberIds = new Set(listChannelMembers(user, channelId).map((m) => m.userId));
  const users = listActiveUsers().filter((u) => u.id !== user.id && memberIds.has(u.id));
  return (
    <div className="mx-auto max-w-2xl">
      <SyncTaskChannel channelId={channelId} />
      <Link href={`/channels/${channelId}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to project
      </Link>
      <h1 className="mb-4 mt-2 text-lg font-semibold">New task</h1>
      <div className="card p-5">
        <NewTaskForm users={users} channelId={channelId} />
      </div>
    </div>
  );
}

import { AppShell } from "@/components/AppShell";
import { listChannels } from "@/server/channels";
import { unreadCount } from "@/server/notifications";
import { requirePageUser } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <AppShell user={user} unread={unreadCount(user)} channels={listChannels(user)}>
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";
import type { SessionUser } from "@/server/auth";
import type { ChannelListItem } from "@/server/channel-types";
import { ActiveChannelProvider } from "./ActiveChannelContext";
import { ChannelSidebar } from "./ChannelSidebar";
import { Nav } from "./Nav";

export function AppShell({
  user,
  unread,
  channels,
  children,
}: {
  user: SessionUser;
  unread: number;
  channels: ChannelListItem[];
  children: ReactNode;
}) {
  return (
    <ActiveChannelProvider>
      <div data-app-shell className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">
        <Nav user={user} unread={unread} />
        <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 overflow-hidden">
          <ChannelSidebar channels={channels} canCreateProjects={user.role === "admin"} />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </main>
        </div>
      </div>
    </ActiveChannelProvider>
  );
}

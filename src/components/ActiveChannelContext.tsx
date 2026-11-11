"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ActiveChannelContext = createContext<{
  channelId: number | null;
  setChannelId: (id: number | null) => void;
} | null>(null);

export function ActiveChannelProvider({ children }: { children: ReactNode }) {
  const [channelId, setChannelId] = useState<number | null>(null);
  return <ActiveChannelContext.Provider value={{ channelId, setChannelId }}>{children}</ActiveChannelContext.Provider>;
}

export function useActiveChannel() {
  const ctx = useContext(ActiveChannelContext);
  if (!ctx) throw new Error("useActiveChannel must be used within ActiveChannelProvider");
  return ctx;
}

/** Keeps the project sidebar highlight in sync while viewing a task. */
export function SyncTaskChannel({ channelId }: { channelId: number }) {
  const { setChannelId } = useActiveChannel();
  useEffect(() => {
    setChannelId(channelId);
    return () => setChannelId(null);
  }, [channelId, setChannelId]);
  return null;
}

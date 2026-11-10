"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/server/auth";
import { api } from "./api";
import { Avatar } from "./ui";

export function Nav({ user, unread }: { user: SessionUser; unread: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: user.role === "admin" ? "Tasks" : "Dashboard" },
    ...(user.role === "admin"
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/activity", label: "Activity Log" },
        ]
      : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function logout() {
    await api("/api/auth/logout").catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white">
            TT
          </span>
          <span className="hidden sm:inline">Task Tracker</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm ${isActive(l.href) ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/tasks/new" className="btn-primary">
            <span aria-hidden>+</span> New Task
          </Link>
          <Link
            href="/notifications"
            className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M10 2a6 6 0 0 0-6 6v2.6l-1.4 2.8A1 1 0 0 0 3.5 15h13a1 1 0 0 0 .9-1.6L16 10.6V8a6 6 0 0 0-6-6Zm0 16a2.5 2.5 0 0 1-2.4-2h4.8A2.5 2.5 0 0 1 10 18Z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100"
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <Avatar name={user.name} id={user.id} size="md" />
              <span className="hidden text-left text-sm leading-tight lg:block">
                <span className="block font-medium">{user.name}</span>
                <span className="block text-xs capitalize text-slate-500">{user.role}</span>
              </span>
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                onMouseLeave={() => setOpen(false)}
              >
                <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{user.email}</div>
                <div className="md:hidden">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
                <button type="button" role="menuitem" onClick={logout} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

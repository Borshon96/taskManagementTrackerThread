import { PageHeader } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { listNotifications } from "@/server/notifications";
import { requirePageUser } from "@/server/session";
import { MarkAllRead, NotificationLink } from "./NotificationControls";

export const metadata = { title: "Notifications · Task Tracker" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const items = listNotifications(user);
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications">{unread > 0 && <MarkAllRead />}</PageHeader>
      {items.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-slate-500">You have no notifications yet.</div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationLink id={n.id} href={n.taskId ? `/tasks/${n.taskId}` : "/"} unread={!n.isRead}>
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-blue-600"}`}
                    aria-label={n.isRead ? undefined : "Unread"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${n.isRead ? "text-slate-700" : "font-medium text-slate-900"}`}>{n.title}</div>
                    {n.body && <div className="truncate text-xs text-slate-500">{n.body}</div>}
                  </div>
                  <time className="shrink-0 text-xs text-slate-400" title={formatDateTime(n.createdAt)}>
                    {formatRelative(n.createdAt)}
                  </time>
                </div>
              </NotificationLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

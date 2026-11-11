import { desc, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { channels, notifications, tasks, users } from "../src/db/schema";
import { listNotifications, markRead, unreadCount } from "../src/server/notifications";

function main() {
  const db = getDb();
  const userA = db.select().from(users).where(eq(users.email, "usera@example.com")).get();
  if (!userA) {
    console.error("No usera in DB — run db:seed");
    process.exit(1);
  }
  const user = { id: userA.id, name: userA.name, email: userA.email, role: userA.role as "user" | "admin" };
  const rows = db.select().from(notifications).where(eq(notifications.userId, user.id)).all();
  console.log("User", user.id, "notifications:", rows.length);
  console.log("Unread count:", unreadCount(user));
  const unread = rows.filter((r) => !r.isRead);
  console.log(
    "Unread rows:",
    unread.map((r) => ({ id: r.id, isRead: r.isRead, title: r.title, taskId: r.taskId })),
  );
  if (unread[0]) {
    const id = unread[0].id;
    const ok = markRead(user, id);
    console.log("markRead", id, "=>", ok);
    const after = db.select().from(notifications).where(eq(notifications.id, id)).get();
    console.log("Row after:", after);
    console.log("Unread count after:", unreadCount(user));
  db.update(notifications).set({ isRead: false }).where(eq(notifications.id, 124)).run();
  const listed = listNotifications(user, 5, 0);
  console.log(
    "List mapped:",
    listed.map((n) => ({ id: n.id, isRead: n.isRead, title: n.title, taskTitle: n.taskTitle })),
  );
  }
  closeDb();
}

main();

import Link from "next/link";
import { requirePageUser } from "@/server/session";
import { listActiveUsers } from "@/server/users";
import { NewTaskForm } from "./NewTaskForm";

export const metadata = { title: "New Task · Task Tracker" };

export default async function NewTaskPage() {
  const user = await requirePageUser();
  const users = listActiveUsers().filter((u) => u.id !== user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to tasks
      </Link>
      <h1 className="mb-4 mt-2 text-lg font-semibold">New task</h1>
      <div className="card p-5">
        <NewTaskForm users={users} />
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/server/session";
import { listUsers } from "@/server/users";
import { UserManager } from "./UserManager";

export const metadata = { title: "Users · Task Tracker" };

export default async function AdminUsersPage() {
  const admin = await requirePageAdmin();
  return (
    <div>
      <PageHeader title="Users" />
      <UserManager users={listUsers(admin)} currentUserId={admin.id} />
    </div>
  );
}

import { redirect } from "next/navigation";

export const metadata = { title: "Notifications · Task Tracker" };

/** Notifications open from the bell in the header (modal). */
export default function NotificationsPage() {
  redirect("/");
}

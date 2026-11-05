import { redirect } from "next/navigation";

// The Admin is one single page now — the users table lives on /admin.
export default function AdminUsersRedirect() {
  redirect("/admin#users");
}

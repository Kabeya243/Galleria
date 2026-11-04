import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function EditorIndexPage() {
  if (!(await getCurrentUser())) redirect("/login");
  redirect("/");
}

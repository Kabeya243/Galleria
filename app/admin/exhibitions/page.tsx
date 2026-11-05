import { redirect } from "next/navigation";

// The Admin is one single page now — the exhibitions table lives on /admin.
export default function AdminExhibitionsRedirect() {
  redirect("/admin#exhibitions");
}

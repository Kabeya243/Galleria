import { redirect } from "next/navigation";
import ToolsPage from "@/components/tools-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Tools — SANAA",
  description:
    "Tools for artists, curators, galleries and collectors: price your work, keep your inventory, know your contacts, present and sell.",
};

export default async function ToolsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return <ToolsPage user={user} exhibitionCount={exhibitionCount} />;
}

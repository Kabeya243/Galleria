import { redirect } from "next/navigation";
import ToolsPage from "@/components/tools-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYWALL_ENABLED, getUserPlanSlug } from "@/lib/subscriptions";

export const metadata = {
  title: "Tools: Lakisa",
  description:
    "Tools for artists, curators, galleries and collectors: price your work, keep your inventory, know your contacts, present and sell.",
};

export default async function ToolsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [exhibitionCount, planSlug] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    getUserPlanSlug(user.id),
  ]);
  return <ToolsPage user={user} exhibitionCount={exhibitionCount} planSlug={planSlug} paywallEnabled={PAYWALL_ENABLED} />;
}

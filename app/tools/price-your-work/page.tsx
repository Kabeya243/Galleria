import { redirect } from "next/navigation";
import PriceCalculator from "@/components/price-calculator";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Price your work — Lakisa Tools",
  description: "Work out a fair price for a piece, from your hours, your materials and its size.",
};

export default async function PriceYourWorkRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("price-your-work", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="priceYourWork"
      eyebrow="priceYourWorkEyebrow"
      description="priceYourWorkDesc"
    >
      <PriceCalculator />
    </ToolsShell>
  );
}

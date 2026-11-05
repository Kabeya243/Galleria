import { redirect } from "next/navigation";
import PriceCalculator from "@/components/price-calculator";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Price your work — SANAA Tools",
  description: "Work out a fair price for a piece, from your hours, your materials and its size.",
};

export default async function PriceYourWorkRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Price your work"
      eyebrow="TOOLS · PRICE YOUR WORK"
      description="What should this piece sell for? Start from what it cost you — your hours and your materials — and let the calculator suggest a range. All prices in US dollars."
    >
      <PriceCalculator />
    </ToolsShell>
  );
}

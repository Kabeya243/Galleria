import { redirect } from "next/navigation";
import PlanCard from "@/components/plan-card";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import page from "@/components/redesign-pages.module.css";

export const metadata = {
  title: "My plan: Lakisa",
  description: "Your current plan, its usage against the limits, and changing plan.",
};

// "My plan" (Nov 2026, Phase 2 shell): the plan card used to sit on
// the dashboard overview, one section among many on a single long
// page. It is its own page now, reached from the sidebar. PlanCard
// fetches its own data; this page only guards the sign-in and renders
// the shell.
export default async function DashboardPlanRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <>
    <div className={page.pageHead}>
      <div>
        <span className={page.eyebrow}>Subscription</span>
        <h1>My plan</h1>
        <p className={page.pageSub}>
          Your current plan, what it includes, and how much of it you have used.
        </p>
      </div>
    </div>

    <PlanCard />
    </>
  );
}

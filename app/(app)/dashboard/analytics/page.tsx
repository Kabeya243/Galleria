import { redirect } from "next/navigation";
import VisitorAnalytics from "@/components/visitor-analytics";
import { getCurrentUser } from "@/lib/auth";
import { loadDashboardAnalytics } from "@/lib/user-dashboard-data";
import dash from "@/components/redesign-dashboard.module.css";
import page from "@/components/redesign-pages.module.css";

export const metadata = {
  title: "Visitor analytics: Lakisa",
  description: "Visits, unique visitors, most viewed artworks, devices, traffic sources and countries, per exhibition.",
};

// Visitor analytics (Nov 2026, Phase 2 shell): the analytics used to
// sit on the dashboard overview, one section among many on a single
// long page. They are their own page now, reached from the sidebar.
// The selected exhibition comes from ?exhibitionId=, defaulting to the
// most recently updated one.
export default async function DashboardAnalyticsRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { exhibitionId } = await searchParams;
  const { exhibitionCount, visitorAnalytics } = await loadDashboardAnalytics(user, exhibitionId);
  return (
    <>
    <div className={page.pageHead}>
      <div>
        <span className={page.eyebrow}>Visits</span>
        <h1>Visitor analytics</h1>
        <p className={page.pageSub}>
          Visits, unique visitors, most viewed artworks, devices, traffic sources and
          countries, per exhibition, with a CSV export.
        </p>
      </div>
    </div>

    <section className={dash.card} aria-label="Visitor statistics">
      <div className={dash.cardHead}>
        <div>
          <span className={dash.eyebrow}>Visits</span>
          <h2>Visitor statistics</h2>
          <p className={dash.cardSub}>
            Per exhibition: pick one to see its own numbers.
          </p>
        </div>
      </div>
      {visitorAnalytics === null ? (
        <p className={dash.empty}>
          No exhibitions yet. Create one to see its visitor statistics here.
        </p>
      ) : (
        <VisitorAnalytics
          {...visitorAnalytics}
          basePath="/dashboard/analytics"
          selectSuffix=""
        />
      )}
    </section>
    </>
  );
}

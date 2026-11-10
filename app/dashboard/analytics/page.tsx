import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import VisitorAnalytics from "@/components/visitor-analytics";
import { getCurrentUser } from "@/lib/auth";
import { loadDashboardAnalytics } from "@/lib/user-dashboard-data";
import styles from "@/components/user-dashboard.module.css";

export const metadata = {
  title: "Visitor analytics: Lakisa",
  description: "Visits, unique visitors, most viewed artworks, devices, traffic sources and countries, per exhibition.",
};

// Visitor analytics (Nov 2026): the analytics used to sit on the
// dashboard overview, one section among many on a single long page.
// They are their own page now, reached from the sidebar. The selected
// exhibition comes from ?exhibitionId=, defaulting to the most
// recently updated one.
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
    <div className="app-shell">
      <Sidebar user={user} active="analytics" exhibitionCount={exhibitionCount} />

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">Visits</span>
              <h1>Visitor analytics</h1>
              <p className="welcome-copy">
                Visits, unique visitors, most viewed artworks, devices, traffic sources and
                countries, per exhibition, with a CSV export.
              </p>
            </div>
          </div>

          <section className={styles.card} aria-label="Visitor statistics">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Visits</span>
                <h2>Visitor statistics</h2>
                <p className={styles.cardSub}>
                  Per exhibition: pick one to see its own numbers.
                </p>
              </div>
            </div>
            {visitorAnalytics === null ? (
              <p className={styles.empty}>
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
        </div>
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminTools,
  relativeTime,
} from "@/lib/admin-data";
import { TOOL_LABELS, type ToolSlug } from "@/lib/tool-use";

export const metadata = {
  title: "Tools used: Lakisa",
  description: "Recorded tool use, per tool, all time and in the last 30 days.",
};

export default async function AdminToolsRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "stats.view")) redirect("/admin");
  const { toolStats, totalToolUses, toolMax, recentToolUses, recentToolUsers } =
    await loadAdminTools();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="Tools used"
        description={`${totalToolUses} ${totalToolUses === 1 ? "use" : "uses"} recorded, per tool, all time and in the last 30 days. Tracking started when this version shipped, so a tool nobody has opened yet shows 0.`}
      />
      <div className="ad-section">
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Uses per tool</h2>
                <p className="ad-card-sub">Every tool, ranked by total uses</p>
              </div>
              <strong className="ad-card-total">
                {totalToolUses} <span>total</span>
              </strong>
            </div>
            <ul className="ad-share ad-scroll">
              {toolStats.map((t) => (
                <li key={t.slug}>
                  <div className="ad-share-row">
                    <span className="ad-share-name">{t.label}</span>
                    <span className="ad-share-count">
                      {t.allTime} total · {t.last30} in 30 days
                    </span>
                  </div>
                  <div className="ad-share-track">
                    <div
                      className="ad-share-fill"
                      style={{ width: `${t.allTime > 0 ? Math.max((t.allTime / toolMax) * 100, 2) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Recent tool activity</h2>
                <p className="ad-card-sub">The latest tools opened, and by whom</p>
              </div>
            </div>
            {recentToolUses.length === 0 ? (
              <EmptyBox
                title="No tool use yet."
                body="Tracking started with this version, uses appear here as soon as someone opens a tool."
              />
            ) : (
              <ul className="ad-feed ad-scroll">
                {recentToolUses.map((use) => {
                  const who = use.userId ? recentToolUsers.get(use.userId) : undefined;
                  return (
                    <li key={use.id}>
                      <span className="ad-feed-dot ad-feed-tool" aria-hidden="true" />
                      <div className="ad-feed-body">
                        <strong>{TOOL_LABELS[use.tool as ToolSlug] ?? use.tool}</strong>
                        <span>{who ? `${who.name} (${who.email})` : "Signed-out visitor"}</span>
                      </div>
                      <span className="ad-feed-time">{relativeTime(use.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

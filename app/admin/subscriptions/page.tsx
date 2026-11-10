import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import AdminShell from "@/components/admin-shell";
import AdminSubscriptions from "@/components/admin-subscriptions";
import { EmptyBox, ShareBars } from "@/components/admin-ui";
import {
  adminSections,
  getAdminContext,
  hasAdminPermission,
  loadAdminShellCounts,
  loadAdminSubscriptions,
} from "@/lib/admin-data";

export const metadata = {
  title: "Subscriptions: Lakisa",
  description: "The plans, subscribers per plan, every account's plan, and plan editing.",
};

// Subscriptions — the plans, subscribers per plan, every account's
// plan, and plan editing. Free trial: the paywall is off, so every
// tool is open to every account; this section manages the structure
// billing will use later. Moved verbatim from the old single admin
// page; the numbers come from lib/admin-data.ts, unchanged.
export default async function AdminSubscriptionsRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "subscriptions.view")) redirect("/admin");
  const canManageSubscriptions = hasAdminPermission(access, "subscriptions.manage");
  const [subs, counts] = await Promise.all([loadAdminSubscriptions(), loadAdminShellCounts()]);
  const {
    plans,
    subscriptionRows,
    subscriptionStats,
    subscriptionMax,
    salesMrr,
    salesPayingByPlan,
    salesConversion,
    salesNewPaid14d,
    salesPrices,
    paidSubscriptions,
    userCount,
    allSubscriptionsCount,
    promoCodes,
    referralStats,
  } = subs;
  return (
    <AdminShell
      user={user}
      title="Subscriptions"
      eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
      description={`${allSubscriptionsCount} subscribers. Everything is free to try for now: the paywall is off, so every tool is open to every account. These plans are the structure billing will use later, once a payment provider is connected.`}
      counts={counts}
      sections={adminSections(access)}
      active="subscriptions"
    >
      <div className="ad-section">
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Subscribers per plan</h2>
                <p className="ad-card-sub">Accounts on each plan</p>
              </div>
            </div>
            {subscriptionStats.length === 0 ? (
              <EmptyBox title="No plans yet." body="Plans are seeded automatically on first read." />
            ) : (
              <ShareBars items={subscriptionStats} max={subscriptionMax} />
            )}
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Paywall status</h2>
                <p className="ad-card-sub">Free trial mode</p>
              </div>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 }}>
              The paywall is <strong>off</strong>: every account can use every tool for free, no
              card, no payment. Plan changes (below, or by the user on the pricing page) are free
              and immediate. To turn billing on later, connect a payment provider first, then set{" "}
              <code>LAKISA_PAYWALL_ENABLED=true</code> in Vercel.
            </p>
            <a className="ad-card-link" href="/pricing" target="_blank" rel="noreferrer">
              See the public pricing page
            </a>
          </section>
        </div>

        <section className="ad-card" style={{ marginTop: 16 }}>
          <div className="ad-card-head">
            <div>
              <h2>Sales</h2>
              <p className="ad-card-sub">
                Real subscription revenue, from the database. Nothing here is a forecast.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Monthly recurring revenue</span>
              <strong className="ad-stat-value">${salesMrr.toFixed(2)}</strong>
              <span className="ad-stat-note">Recurring terms only; one-month terms excluded</span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Total collected</span>
              <strong className="ad-stat-value">$0.00</strong>
              <span className="ad-stat-note">Billing is not connected yet, nothing charged</span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Paying subscribers</span>
              <strong className="ad-stat-value">{paidSubscriptions.length}</strong>
              <span className="ad-stat-note">
                {salesPayingByPlan.map((p) => `${p.name} ${p.count}`).join(" · ") || "No paid plan yet"}
              </span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Conversion</span>
              <strong className="ad-stat-value">{salesConversion.toFixed(1)}%</strong>
              <span className="ad-stat-note">
                {paidSubscriptions.length} paying of {userCount} accounts
              </span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">New paid, last 14 days</span>
              <strong className="ad-stat-value">{salesNewPaid14d}</strong>
              <span className="ad-stat-note">Paid plans started in the last 14 days</span>
            </div>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6 }}>
            Current prices: {salesPrices}
          </p>
        </section>
        <AdminSubscriptions
          plans={plans}
          subscriptions={subscriptionRows}
          promoCodes={promoCodes}
          referralStats={referralStats}
          canManage={canManageSubscriptions}
        />
      </div>
    </AdminShell>
  );
}

import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminTestReports,
} from "@/lib/admin-data";

export const metadata = {
  title: "Test reports: Lakisa",
  description: "Results of the automated feature tests for the new tools.",
};

export default async function AdminTestReportsRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "stats.view")) redirect("/admin");
  const testReport = await loadAdminTestReports();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="Test reports"
        description="Results of the automated feature tests for the new tools, profile photos, works wall, website builder (51 templates) and portfolio PDF builder (50 templates)."
      />
      <div className="ad-section">
        {!testReport ? (
          <EmptyBox
            title="No test report yet."
            body="Run node scripts/test-new-features.mjs from the repo to generate public/test-reports/latest.json. It will show up here."
          />
        ) : (
          <div className="ad-card ad-table-wrap">
            <p style={{ margin: "0 0 12px", fontSize: 13 }}>
              <strong>
                {testReport.summary.passed}/{testReport.summary.total} passed
              </strong>
              {testReport.summary.failed > 0 && (
                <> · <strong style={{ color: "#9a2b2b" }}>{testReport.summary.failed} failed</strong></>
              )}
              {testReport.summary.skipped > 0 && <> · {testReport.summary.skipped} skipped</>}
              {" · "}generated {new Date(testReport.generatedAt).toLocaleString("en-GB")}
              {" · "}commit <code>{testReport.commit}</code>
            </p>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {testReport.checks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.feature}</td>
                    <td>{c.name}</td>
                    <td>
                      {c.status === "pass" ? (
                        <strong style={{ color: "#2e7d32" }}>Passed</strong>
                      ) : c.status === "fail" ? (
                        <strong style={{ color: "#9a2b2b" }}>Failed</strong>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Skipped</span>
                      )}
                    </td>
                    <td>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/tools.module.css";

export type AnalyticsDay = { date: string; visits: number; unique: number };
export type CountRow = { name: string; count: number };
export type TopArtwork = { id: string; title: string; views: number };
export type AnalyticsExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
};

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Same format as the dashboard's Visitor statistics, so the average
// time reads identically on both pages.
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "N/A";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

export default function VisitorAnalytics({
  exhibitions,
  selectedId,
  selectedSlug,
  selectedTitle,
  daily,
  totalVisits30,
  uniqueVisitors30,
  totalVisitsAllTime,
  uniqueVisitorsAllTime,
  avgDurationSeconds,
  topArtworks,
  devices,
  referrers,
  countries,
}: {
  exhibitions: AnalyticsExhibition[];
  selectedId: string;
  selectedSlug: string;
  selectedTitle: string;
  daily: AnalyticsDay[];
  totalVisits30: number;
  uniqueVisitors30: number;
  totalVisitsAllTime: number;
  uniqueVisitorsAllTime: number;
  avgDurationSeconds: number | null;
  topArtworks: TopArtwork[];
  devices: CountRow[];
  referrers: CountRow[];
  countries: CountRow[];
}) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const maxDaily = Math.max(...daily.map((d) => d.visits), 1);
  const hasVisits = totalVisitsAllTime > 0;

  // A visit is one exhibition open. Artwork-detail opens are counted
  // separately under Most viewed artworks and never inflate these totals.
  const totals = useMemo(
    () => [
      { value: totalVisits30, label: "Visits · last 30 days" },
      { value: uniqueVisitors30, label: "Unique visitors · last 30 days" },
      { value: totalVisitsAllTime, label: "Visits · all time" },
      { value: uniqueVisitorsAllTime, label: "Unique visitors · all time" },
      { value: formatDuration(avgDurationSeconds), label: "Average time · all time" },
    ],
    [totalVisits30, uniqueVisitors30, totalVisitsAllTime, uniqueVisitorsAllTime, avgDurationSeconds],
  );

  function downloadCsv() {
    setDownloading(true);
    try {
      const lines: (string | number)[][] = [
        ["Visitor Analytics: Lakisa"],
        ["Exhibition", selectedTitle],
        ["Exported", new Date().toISOString().slice(0, 10)],
        [],
        ["Summary"],
        ["Visits last 30 days", totalVisits30],
        ["Unique visitors last 30 days", uniqueVisitors30],
        ["Visits all time", totalVisitsAllTime],
        ["Unique visitors all time", uniqueVisitorsAllTime],
        ["Average time all time", formatDuration(avgDurationSeconds)],
        [],
        ["Visits per day (last 30 days)"],
        ["Date", "Visits", "Unique visitors"],
        ...daily.map((d) => [d.date, d.visits, d.unique]),
        [],
        ["Most viewed artworks"],
        ["Artwork", "Artwork-detail views"],
        ...topArtworks.map((a) => [a.title, a.views]),
        [],
        ["Devices"],
        ["Device", "Visits"],
        ...devices.map((d) => [d.name, d.count]),
        [],
        ["Traffic sources"],
        ["Referrer", "Visits"],
        ...referrers.map((r) => [r.name, r.count]),
        [],
        ["Countries"],
        ["Country", "Visits"],
        ...countries.map((c) => [c.name, c.count]),
      ];
      const csv = lines.map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visitor-analytics-${selectedSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  function shareRow(rows: CountRow[], total: number) {
    return rows.map((row) => (
      <li key={row.name} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
          <span>{row.name}</span>
          <span>
            {row.count} · {total > 0 ? Math.round((row.count / total) * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 6, marginTop: 5, borderRadius: 3, background: "var(--line)" }}>
          <div
            style={{
              width: `${total > 0 ? Math.max((row.count / total) * 100, 2) : 0}%`,
              height: "100%",
              borderRadius: 3,
              background: "var(--gold, #ffffff)",
            }}
          />
        </div>
      </li>
    ));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "end", flexWrap: "wrap", marginBottom: 24 }}>
        <label className={styles.field} style={{ minWidth: 280, flex: 1 }}>
          Exhibition
          <select
            value={selectedId}
            onChange={(e) => router.push(`/tools/visitor-analytics?exhibitionId=${e.target.value}`)}
          >
            {exhibitions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
                {e.status !== "public" ? ` (${e.status})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="galleries-open-button"
          onClick={downloadCsv}
          disabled={downloading || !hasVisits}
          title={hasVisits ? "Download a CSV report of this exhibition's visits" : "No visits to export yet"}
        >
          {downloading ? "Preparing…" : "Download CSV report"}
        </button>
      </div>

      {/* The chart and totals always render — with no history they show
          empty axes and zeros, so the page never looks broken before
          the first visit. Only the breakdowns (artworks, devices,
          sources, countries) wait for real visits. */}
      {!hasVisits && (
        <div className={styles.emptyBox} style={{ marginBottom: 24 }}>
          <strong>No visits yet for “{selectedTitle}”.</strong>
          <p>
            Visit history starts from when per-day visit tracking was added (November 2026): earlier visits only
            count towards the exhibition&apos;s total views, not this chart. Every time someone opens the public
            exhibition, one anonymous visit is logged, and opening an artwork&apos;s details counts towards its views.
            Share the exhibition link and the numbers will appear here.
          </p>
        </div>
      )}

      <div className={styles.summaryRow}>
        {totals.map((t) => (
          <div key={t.label}>
            <strong>{t.value}</strong>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: 12 }}>
        Visits count each time this exhibition is opened. Opening an artwork&apos;s details counts towards that
        artwork&apos;s views, not towards visits.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Visits: last 30 days</h2>
        <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
          One bar per day. The number above a bar is that day&apos;s visits; unique visitors count each anonymous
          visitor once per day.
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
          {daily.map((d) => (
            <div
              key={d.date}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}
              title={`${prettyDate(d.date)}: ${d.visits} visit${d.visits === 1 ? "" : "s"}, ${d.unique} unique`}
            >
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{d.visits > 0 ? d.visits : ""}</span>
              <div
                style={{
                  width: "100%",
                  maxWidth: 22,
                  height: `${d.visits > 0 ? Math.max((d.visits / maxDaily) * 100, 6) : 1.5}%`,
                  background: d.visits === maxDaily && d.visits > 0 ? "#ffffff" : "var(--ink)",
                  opacity: d.visits > 0 ? 0.85 : 0.25,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
          {daily.map((d, i) => (
            <span key={d.date} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--muted)" }}>
              {i % 5 === 0 ? new Date(`${d.date}T00:00:00Z`).getUTCDate() : ""}
            </span>
          ))}
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>
          {prettyDate(daily[0]?.date ?? "")} – {prettyDate(daily[daily.length - 1]?.date ?? "")}
          {" · "}
          {uniqueVisitors30} unique visitor{uniqueVisitors30 === 1 ? "" : "s"} in the period
        </p>
      </section>

      {hasVisits && (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Most viewed artworks</h2>
            <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
              Counted when a visitor opens an artwork&apos;s detail panel. Exhibition views without opening an artwork
              are not attributed to any work.
            </p>
            {topArtworks.length === 0 ? (
              <div className={styles.emptyBox}>
                <strong>No artwork views yet.</strong>
                <p>Visitors have opened the exhibition, but nobody has opened an artwork&apos;s details so far.</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.inventoryTable}>
                <thead>
                  <tr>
                    <th>Artwork</th>
                    <th>Detail views</th>
                  </tr>
                </thead>
                <tbody>
                  {topArtworks.map((a, i) => (
                    <tr key={a.id}>
                      <td>
                        {i + 1}. {a.title}
                      </td>
                      <td>{a.views}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Devices</h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>From the visitor&apos;s browser.</p>
              {devices.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No device data yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{shareRow(devices, totalVisitsAllTime)}</ul>
              )}
            </section>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Traffic sources</h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
                Where visitors came from, by referrer. “Direct or unknown” means no referrer was sent.
              </p>
              {referrers.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No referrer data yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{shareRow(referrers, totalVisitsAllTime)}</ul>
              )}
            </section>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Countries</h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
                Only where the platform reports a country. “Unknown” is shown otherwise, never guessed.
              </p>
              {countries.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No country data yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{shareRow(countries, totalVisitsAllTime)}</ul>
              )}
            </section>
          </div>
        </>
      )}

      <aside
        style={{
          marginTop: 36,
          padding: 18,
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "var(--room-color)",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--muted)",
        }}
      >
        <strong style={{ color: "var(--ink)" }}>Privacy: what is (and isn&apos;t) collected.</strong>
        <br />
        Visits are counted with an anonymous random id stored in a cookie on the visitor&apos;s own browser. No names,
        no email addresses, no IP addresses and no personal data are collected or stored. Country is recorded only
        when the hosting platform reports it; device type comes from the browser&apos;s user-agent and the referrer
        from the page the visitor came from. Only aggregate counts are shown here. Individual visits cannot be traced
        back to a person. Data is kept to the minimum needed to answer “how is this exhibition doing?”.
      </aside>
    </div>
  );
}

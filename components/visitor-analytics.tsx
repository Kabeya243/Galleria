"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

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
  // Where the exhibition selector navigates. The analytics live on
  // their own dashboard page (since Nov 2026), so the default
  // navigates to /dashboard/analytics?exhibitionId=…
  basePath = "/dashboard/analytics",
  selectSuffix = "",
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
  basePath?: string;
  selectSuffix?: string;
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
      <div key={row.name} className={page.barRow}>
        <span>{row.name}</span>
        <span className={page.barTrack}>
          <span
            className={page.barFill}
            style={{ width: `${total > 0 ? Math.max((row.count / total) * 100, 2) : 0}%`, display: "block" }}
          />
        </span>
        <span className={`${page.barValue} ${dash.tnum}`}>
          {row.count} · {total > 0 ? Math.round((row.count / total) * 100) : 0}%
        </span>
      </div>
    ));
  }

  return (
    <div className={page.sectionStack}>
      <div style={{ display: "flex", gap: 14, alignItems: "end", flexWrap: "wrap" }}>
        <label className={page.field} style={{ minWidth: 280, flex: 1 }}>
          <span>Exhibition</span>
          <select
            value={selectedId}
            onChange={(e) => router.push(`${basePath}?exhibitionId=${e.target.value}${selectSuffix}`)}
            className={page.select}
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
          className={page.btn}
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
        <div className={page.emptyState} style={{ border: "1px solid var(--rd-border)", borderRadius: 16, padding: "24px 20px" }}>
          <h3>No visits yet for “{selectedTitle}”.</h3>
          <p>
            Visit history starts from when per-day visit tracking was added (November 2026): earlier visits only
            count towards the exhibition&apos;s total views, not this chart. Every time someone opens the public
            exhibition, one anonymous visit is logged, and opening an artwork&apos;s details counts towards its views.
            Share the exhibition link and the numbers will appear here.
          </p>
        </div>
      )}

      <div className={dash.kpis}>
        {totals.map((t) => (
          <article key={t.label} className={`${dash.card} ${dash.kpi}`}>
            <div className={dash.kpiLabel}>
              <span>{t.label}</span>
            </div>
            <div className={`${dash.kpiValue} ${dash.tnum}`}>{t.value}</div>
          </article>
        ))}
      </div>
      <p className={dash.cardSub} style={{ margin: 0 }}>
        Visits count each time this exhibition is opened. Opening an artwork&apos;s details counts towards that
        artwork&apos;s views, not towards visits.
      </p>

      <section>
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Visits: last 30 days</h2>
        <p className={dash.cardSub} style={{ margin: "0 0 16px" }}>
          One bar per day. The number above a bar is that day&apos;s visits; unique visitors count each anonymous
          visitor once per day.
        </p>
        <div className={dash.chart} style={{ gap: 3 }}>
          {daily.map((d) => (
            <div
              key={d.date}
              className={dash.barWrap}
              title={`${prettyDate(d.date)}: ${d.visits} visit${d.visits === 1 ? "" : "s"}, ${d.unique} unique`}
            >
              {d.visits > 0 && <span className={`${dash.barValue} ${dash.tnum}`}>{d.visits}</span>}
              <div
                className={`${dash.bar} ${d.visits === maxDaily && d.visits > 0 ? dash.barRecent : ""}`}
                style={{ height: `${d.visits > 0 ? Math.max((d.visits / maxDaily) * 100, 6) : 2}%`, maxWidth: 22 }}
              />
              <span className={dash.barLabel} />
            </div>
          ))}
        </div>
        <p className={dash.cardSub} style={{ margin: "12px 0 0" }}>
          {prettyDate(daily[0]?.date ?? "")} – {prettyDate(daily[daily.length - 1]?.date ?? "")}
          {" · "}
          {uniqueVisitors30} unique visitor{uniqueVisitors30 === 1 ? "" : "s"} in the period
        </p>
      </section>

      {hasVisits && (
        <>
          <section>
            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Most viewed artworks</h2>
            <p className={dash.cardSub} style={{ margin: "0 0 16px" }}>
              Counted when a visitor opens an artwork&apos;s detail panel. Exhibition views without opening an artwork
              are not attributed to any work.
            </p>
            {topArtworks.length === 0 ? (
              <p className={dash.empty}>No artwork views yet. Visitors have opened the exhibition, but nobody has opened an artwork&apos;s details so far.</p>
            ) : (
              <div className={page.tableWrap}>
                <table className={page.table}>
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
                        <td className={dash.tnum}>{a.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Devices</h2>
              <p className={dash.cardSub} style={{ margin: "0 0 12px" }}>From the visitor&apos;s browser.</p>
              {devices.length === 0 ? (
                <p className={dash.empty}>No device data yet.</p>
              ) : (
                <div>{shareRow(devices, totalVisitsAllTime)}</div>
              )}
            </section>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Traffic sources</h2>
              <p className={dash.cardSub} style={{ margin: "0 0 12px" }}>
                Where visitors came from, by referrer. “Direct or unknown” means no referrer was sent.
              </p>
              {referrers.length === 0 ? (
                <p className={dash.empty}>No referrer data yet.</p>
              ) : (
                <div>{shareRow(referrers, totalVisitsAllTime)}</div>
              )}
            </section>
            <section>
              <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Countries</h2>
              <p className={dash.cardSub} style={{ margin: "0 0 12px" }}>
                Only where the platform reports a country. “Unknown” is shown otherwise, never guessed.
              </p>
              {countries.length === 0 ? (
                <p className={dash.empty}>No country data yet.</p>
              ) : (
                <div>{shareRow(countries, totalVisitsAllTime)}</div>
              )}
            </section>
          </div>
        </>
      )}

      <aside className={dash.card}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--rd-t2)" }}>
          <strong style={{ color: "var(--rd-text)" }}>Privacy: what is (and isn&apos;t) collected.</strong>
          <br />
          Visits are counted with an anonymous random id stored in a cookie on the visitor&apos;s own browser. No names,
          no email addresses, no IP addresses and no personal data are collected or stored. Country is recorded only
          when the hosting platform reports it; device type comes from the browser&apos;s user-agent and the referrer
          from the page the visitor came from. Only aggregate counts are shown here. Individual visits cannot be traced
          back to a person. Data is kept to the minimum needed to answer “how is this exhibition doing?”.
        </p>
      </aside>
    </div>
  );
}

// Printable portfolio renderer — the shared render used by the Portfolio
// PDF builder's on-screen preview AND by window.print() export, so what
// the artist previews is exactly what the PDF contains. One source of
// truth, no drift.
//
// Export is print-based (window.print() + the print stylesheet below;
// the browser's "Save as PDF" produces the file). No PDF library is in
// the stack, and no new dependency was added — that was the deliberate
// choice: a print stylesheet is lighter and keeps the PDF pixel-faithful
// to the preview.

import type { PdfTemplate } from "@/lib/pdf-templates";

export type PortfolioWork = {
  id: string;
  title: string;
  year: string | null;
  medium: string | null;
  dimensions: string | null;
  imageUrl: string | null;
  color: string;
  accent: string;
};

export type PortfolioConfig = {
  title: string;
  artistName: string;
  bio: string;
  contact: string;
};

export default function PortfolioPrint({
  template,
  config,
  works,
}: {
  template: PdfTemplate;
  config: PortfolioConfig;
  works: PortfolioWork[];
}) {
  const t = template;
  const coverWork = works[0];
  const heading = (size: number): React.CSSProperties => ({
    fontFamily: t.headingFont,
    fontSize: size,
    lineHeight: 1.15,
    fontWeight: 600,
    margin: 0,
    color: t.ink,
  });
  const caption = (w: PortfolioWork) =>
    [w.title, w.year, w.medium, w.dimensions].filter(Boolean).join(" — ");

  const workVisual = (w: PortfolioWork, height: number) =>
    w.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={w.imageUrl} alt={w.title} style={{ width: "100%", height, objectFit: "cover", display: "block" }} />
    ) : (
      <div style={{ width: "100%", height, background: `linear-gradient(135deg, ${w.color}, ${w.accent})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 15, fontFamily: t.headingFont }}>
        {w.title}
      </div>
    );

  return (
    <div className="portfolio-print" style={{ background: t.pageBg, color: t.ink, fontFamily: t.bodyFont }}>
      {/* Cover */}
      <section className="pdf-page pdf-cover" style={{ minHeight: 720, display: "flex", flexDirection: "column", justifyContent: "center", padding: 48, textAlign: t.headerAlign }}>
        {t.coverStyle === "image" && coverWork ? (
          <>
            <div style={{ margin: "-48px -48px 32px" }}>{workVisual(coverWork, 380)}</div>
            <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent, margin: "0 0 12px" }}>
              Portfolio — {config.artistName}
            </p>
            <h1 style={heading(44)}>{config.title || config.artistName}</h1>
            <p style={{ fontSize: 14, color: t.muted, marginTop: 12 }}>{coverWork.title}{coverWork.year ? `, ${coverWork.year}` : ""}</p>
          </>
        ) : t.coverStyle === "split" && coverWork ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center", textAlign: "left" }}>
            <div>
              <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent, margin: "0 0 12px" }}>
                Portfolio — {config.artistName}
              </p>
              <h1 style={heading(40)}>{config.title || config.artistName}</h1>
              {config.bio && <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6, marginTop: 14 }}>{config.bio}</p>}
            </div>
            <div>{workVisual(coverWork, 420)}</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent, margin: "0 0 12px" }}>
              Portfolio — {config.artistName}
            </p>
            <h1 style={heading(48)}>{config.title || config.artistName}</h1>
            <div style={{ width: 56, height: 2, background: t.accent, margin: t.headerAlign === "center" ? "20px auto 0" : "20px 0 0" }} />
            {config.bio && <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65, maxWidth: 520, margin: t.headerAlign === "center" ? "20px auto 0" : "20px 0 0" }}>{config.bio}</p>}
          </>
        )}
      </section>

      {/* Bio — shown on its own page unless the split cover already carried it */}
      {config.bio && t.coverStyle !== "split" && (
        <section className="pdf-page" style={{ padding: 48 }}>
          <h2 style={{ ...heading(22), borderBottom: `1px solid ${t.line}`, paddingBottom: 12 }}>About the artist</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: t.ink, marginTop: 18, whiteSpace: "pre-line" }}>{config.bio}</p>
        </section>
      )}

      {/* Works */}
      <section className="pdf-page" style={{ padding: 48 }}>
        <h2 style={{ ...heading(22), borderBottom: `1px solid ${t.line}`, paddingBottom: 12, marginBottom: 24 }}>Selected works</h2>
        {works.length === 0 ? (
          <p style={{ color: t.muted }}>No works selected yet — pick works in the builder to fill this portfolio.</p>
        ) : t.worksLayout === "large" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {works.map((w) => (
              <figure key={w.id} className="pdf-work" style={{ margin: 0 }}>
                {workVisual(w, 440)}
                <figcaption style={{ fontSize: 13, color: t.muted, marginTop: 10 }}>{caption(w)}</figcaption>
              </figure>
            ))}
          </div>
        ) : t.worksLayout === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {works.map((w) => (
              <figure key={w.id} className="pdf-work" style={{ margin: 0, display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, alignItems: "start" }}>
                {workVisual(w, 140)}
                <figcaption style={{ fontSize: 13, lineHeight: 1.55 }}>
                  <strong style={{ color: t.ink, fontSize: 15, fontFamily: t.headingFont }}>{w.title}</strong>
                  <br />
                  <span style={{ color: t.muted }}>{[w.year, w.medium, w.dimensions].filter(Boolean).join(" · ")}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {works.map((w) => (
              <figure key={w.id} className="pdf-work" style={{ margin: 0 }}>
                {workVisual(w, 220)}
                <figcaption style={{ fontSize: 12, color: t.muted, marginTop: 8 }}>{caption(w)}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="pdf-page" style={{ padding: 48, borderTop: `1px solid ${t.line}` }}>
        <h2 style={{ ...heading(18) }}>Contact</h2>
        <p style={{ fontSize: 14, color: t.muted, marginTop: 10, whiteSpace: "pre-line" }}>{config.contact || config.artistName}</p>
        <p style={{ fontSize: 12, color: t.muted, marginTop: 24 }}>Portfolio — {config.artistName} · Made with SANAA</p>
      </section>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .portfolio-print, .portfolio-print * { visibility: visible !important; }
          .portfolio-print { position: absolute !important; inset: 0 !important; width: 100% !important; }
          .pdf-page { break-after: page; }
          .pdf-page:last-child { break-after: auto; }
          .pdf-work { break-inside: avoid; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import styles from "./tools.module.css";

export type CertificateArtwork = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
  artist: string;
  imageUrl: string | null;
};

// ---------------------------------------------------------------------------
// Certificate Studio
//
// A certificate of authenticity, built from the artist's own artwork record:
// editable fields, three templates in the white-gallery design language,
// a real QR code drawn on canvas (no external QR service), and issue /
// reprint / revoke backed by /api/saved-work (kind "certificate").
// Export is honest: the browser's print dialog saves the certificate as a
// one-page PDF — there is no separate PDF generator.
// ---------------------------------------------------------------------------

type TemplateId = "classic" | "minimal" | "gallery";
type PaperSize = "A4" | "Letter";
type Orientation = "portrait" | "landscape";
type BorderStyle = "none" | "single" | "double" | "gold";

type CertificateConfig = {
  artworkId: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  imageUrl: string | null;
  editionNumber: string;
  editionSize: string;
  issueDate: string; // yyyy-mm-dd
  place: string;
  signatureName: string;
  signatureText: string;
  certificateId: string;
  template: TemplateId;
  paperSize: PaperSize;
  orientation: Orientation;
  border: BorderStyle;
  goldAccent: boolean;
  showImage: boolean;
  verificationNote: string;
};

type SavedCertificate = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  artworkId: string | null;
  createdAt: string;
  updatedAt: string;
};

const GOLD = "#000000";
const INK = "#1a1a1a";
const SERIF = '"Fraunces", Georgia, serif';

const DEFAULT_VERIFICATION_NOTE =
  "This certificate accompanies the original work described above. To check it, compare the certificate ID printed here with the artist's own records, or scan the QR code, which carries the certificate ID, the work's title and the artist's name.";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateCertificateId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `SANAA-${new Date().getFullYear()}-${suffix}`;
}

function formatIssueDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function configForArtwork(artwork: CertificateArtwork, artistName: string): CertificateConfig {
  return {
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist || artistName,
    year: artwork.year,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    imageUrl: artwork.imageUrl,
    editionNumber: "1",
    editionSize: "1",
    issueDate: todayIso(),
    place: "Kampala, Uganda",
    signatureName: artwork.artist || artistName,
    signatureText: "",
    certificateId: generateCertificateId(),
    template: "classic",
    paperSize: "A4",
    orientation: "portrait",
    border: "double",
    goldAccent: true,
    showImage: true,
    verificationNote: DEFAULT_VERIFICATION_NOTE,
  };
}

function configFromSaved(data: Record<string, unknown>, fallback: CertificateConfig): CertificateConfig {
  const merged = { ...fallback, ...(data as Partial<CertificateConfig>) };
  // Guard the enums against stale / hand-edited rows.
  if (!["classic", "minimal", "gallery"].includes(merged.template)) merged.template = "classic";
  if (!["A4", "Letter"].includes(merged.paperSize)) merged.paperSize = "A4";
  if (!["portrait", "landscape"].includes(merged.orientation)) merged.orientation = "portrait";
  if (!["none", "single", "double", "gold"].includes(merged.border)) merged.border = "double";
  return merged;
}

function verificationPayload(cfg: CertificateConfig): string {
  return (
    `Certificate of Authenticity ${cfg.certificateId}\n` +
    `"${cfg.title}" by ${cfg.artist}, ${cfg.year}\n` +
    `${cfg.medium}, ${cfg.dimensions}\n` +
    `Edition ${cfg.editionNumber}/${cfg.editionSize}\n` +
    `Verify this certificate ID against the artist's records.`
  );
}

function editionLabel(cfg: CertificateConfig): string {
  const n = cfg.editionNumber.trim() || "1";
  const size = cfg.editionSize.trim() || "1";
  return size === "1" ? `${n} / 1 — unique work` : `No. ${n} of ${size}`;
}

const TEMPLATES: { id: TemplateId; name: string; blurb: string }[] = [
  { id: "classic", name: "Classic", blurb: "Centred, formal, double rule — the traditional certificate." },
  { id: "minimal", name: "Minimal", blurb: "Quiet and spare: small type, wide margins, one thin rule." },
  { id: "gallery", name: "Gallery", blurb: "The work leads: large image, generous title, gallery-label details." },
];

export default function CertificateTool({
  artistName,
  artworks,
}: {
  artistName: string;
  artworks: CertificateArtwork[];
}) {
  const firstArtwork = artworks[0];
  const [cfg, setCfg] = useState<CertificateConfig | null>(() =>
    firstArtwork ? configForArtwork(firstArtwork, artistName) : null,
  );
  const [saved, setSaved] = useState<SavedCertificate[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const [qrError, setQrError] = useState(false);

  const selectedArtwork = useMemo(
    () => artworks.find((artwork) => artwork.id === cfg?.artworkId) ?? firstArtwork,
    [artworks, cfg?.artworkId, firstArtwork],
  );

  // Load issued certificates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/saved-work?kind=certificate");
        if (!res.ok) throw new Error("Could not load your issued certificates.");
        const json = (await res.json()) as { saved: SavedCertificate[] };
        if (!cancelled) setSaved(json.saved ?? []);
      } catch (error) {
        if (!cancelled) setSavedError(error instanceof Error ? error.message : "Could not load your issued certificates.");
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Draw the QR code on canvas whenever the verification payload changes.
  const payload = cfg ? verificationPayload(cfg) : "";
  useEffect(() => {
    const canvas = qrRef.current;
    if (!canvas || !payload) return;
    QRCode.toCanvas(canvas, payload, {
      width: 132,
      margin: 1,
      color: { dark: INK, light: "#ffffff" },
    }).catch(() => setQrError(true));
  }, [payload]);

  if (!cfg || !selectedArtwork) {
    return (
      <div className={styles.emptyBox}>
        <strong>No artworks yet.</strong>
        <p>Add a work in the editor first — a certificate needs a real piece behind it.</p>
      </div>
    );
  }

  const set = <K extends keyof CertificateConfig>(key: K, value: CertificateConfig[K]) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
    setIssueMsg(null);
    setIssueError(null);
  };

  const pickArtwork = (artworkId: string) => {
    const artwork = artworks.find((item) => item.id === artworkId);
    if (!artwork) return;
    setCfg((prev) => {
      if (!prev) return prev;
      // A new artwork starts a fresh certificate: prefill from its record
      // and mint a new ID; the design choices stay as the artist set them.
      const fresh = configForArtwork(artwork, artistName);
      return { ...prev, ...fresh, template: prev.template, paperSize: prev.paperSize, orientation: prev.orientation, border: prev.border, goldAccent: prev.goldAccent, showImage: prev.showImage, verificationNote: prev.verificationNote };
    });
    setLoadedId(null);
    setIssueMsg(null);
    setIssueError(null);
  };

  const newCertificate = () => {
    setCfg(configForArtwork(selectedArtwork, artistName));
    setLoadedId(null);
    setIssueMsg(null);
    setIssueError(null);
  };

  const issueCertificate = async (asNew: boolean) => {
    setSaving(true);
    setIssueMsg(null);
    setIssueError(null);
    try {
      if (asNew || !loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "certificate",
            title: `${cfg.title} — ${cfg.certificateId}`,
            data: cfg,
            artworkId: cfg.artworkId,
          }),
        });
        if (!res.ok) throw new Error("Could not issue the certificate. Sign in and try again.");
        const json = (await res.json()) as { saved: SavedCertificate };
        setSaved((prev) => [json.saved, ...prev]);
        setLoadedId(json.saved.id);
        setIssueMsg(`Issued as ${cfg.certificateId}. It is now in your issued list below — print it or save it as a PDF from the print dialog.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title: `${cfg.title} — ${cfg.certificateId}`, data: cfg }),
        });
        if (!res.ok) throw new Error("Could not update the saved certificate.");
        const json = (await res.json()) as { saved: SavedCertificate };
        setSaved((prev) => prev.map((item) => (item.id === loadedId ? json.saved : item)));
        setIssueMsg(`Saved changes to ${cfg.certificateId}.`);
      }
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Could not save the certificate.");
    } finally {
      setSaving(false);
    }
  };

  const loadSaved = (row: SavedCertificate) => {
    const fallback = row.artworkId
      ? configForArtwork(artworks.find((item) => item.id === row.artworkId) ?? selectedArtwork, artistName)
      : cfg;
    setCfg(configFromSaved(row.data, fallback));
    setLoadedId(row.id);
    setIssueMsg(null);
    setIssueError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reprintSaved = (row: SavedCertificate) => {
    loadSaved(row);
    window.setTimeout(() => window.print(), 350);
  };

  const revokeSaved = async (row: SavedCertificate) => {
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not revoke the certificate.");
      setSaved((prev) => prev.filter((item) => item.id !== row.id));
      if (loadedId === row.id) {
        setLoadedId(null);
        newCertificate();
      }
      setConfirmDeleteId(null);
      setIssueMsg(`Revoked ${row.title}. It no longer appears in your issued list — tell anyone holding a printed copy directly, as paper already handed out cannot be recalled from here.`);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Could not revoke the certificate.");
    } finally {
      setDeletingId(null);
    }
  };

  // -- Preview styling (same white-gallery language: paper #fdfdfc, ink, gold) --
  const isLandscape = cfg.orientation === "landscape";
  const paperRatio = cfg.paperSize === "A4" ? (isLandscape ? 297 / 210 : 210 / 297) : isLandscape ? 11 / 8.5 : 8.5 / 11;
  const borderStyle =
    cfg.border === "none"
      ? "1px solid #e8e6e0"
      : cfg.border === "single"
        ? "1px solid #1a1a1a"
        : cfg.border === "double"
          ? "4px double #1a1a1a"
          : "1px solid #000000";
  const accent = cfg.goldAccent ? GOLD : INK;
  const template = TEMPLATES.find((item) => item.id === cfg.template) ?? TEMPLATES[0];

  const sheetStyle: React.CSSProperties = {
    maxWidth: isLandscape ? 820 : 640,
    width: "100%",
    margin: "0 auto",
    padding: "clamp(22px, 5vw, 52px) clamp(20px, 6vw, 56px)",
    border: borderStyle,
    background: "#fdfdfc",
    color: INK,
    textAlign: cfg.template === "minimal" ? "left" : "center",
    aspectRatio: `${paperRatio}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const printCss = `
@media print {
  @page { size: ${cfg.paperSize} ${cfg.orientation}; margin: 0; }
  body * { visibility: hidden !important; }
  .cert-print-sheet, .cert-print-sheet * { visibility: visible !important; }
  .cert-print-sheet {
    position: absolute !important; left: 0; top: 0; width: 100% !important;
    max-width: none !important; aspect-ratio: auto !important; margin: 0 !important;
    min-height: 100%; box-shadow: none !important;
  }
}
`;

  return (
    <div>
      {/* Print stylesheet: only the certificate sheet prints, on one page. */}
      <style>{printCss}</style>

      {/* -- Controls ------------------------------------------------------ */}
      <div className={styles.certificateControls}>
        <label className={styles.field}>
          <span>Artwork</span>
          <select value={cfg.artworkId} onChange={(event) => pickArtwork(event.target.value)}>
            {artworks.map((artwork) => (
              <option key={artwork.id} value={artwork.id}>
                {artwork.title} ({artwork.year})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={() => issueCertificate(false)} disabled={saving}>
          {saving ? "Saving…" : loadedId ? "Update saved certificate" : "Issue certificate"}
        </button>
        {loadedId && (
          <button type="button" className="editor-secondary-button" onClick={() => issueCertificate(true)} disabled={saving}>
            Issue as new
          </button>
        )}
        <button type="button" className="editor-secondary-button" onClick={() => window.print()}>
          Print / save as PDF
        </button>
        <button type="button" className="editor-secondary-button" onClick={newCertificate}>
          New certificate
        </button>
      </div>

      {issueMsg && (
        <p role="status" style={{ margin: "0 0 16px", color: "#3d5a3a", fontSize: 13 }}>
          {issueMsg}
        </p>
      )}
      {issueError && (
        <p role="alert" style={{ margin: "0 0 16px", color: "#8a2f2f", fontSize: 13 }}>
          {issueError}
        </p>
      )}
      {loadedId && (
        <p style={{ margin: "0 0 16px", color: "#666", fontSize: 12 }}>
          Editing a saved certificate. “Update saved certificate” keeps the same record; “Issue as new” mints a separate one.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
        {/* -- Field editor ------------------------------------------------ */}
        <div style={{ display: "grid", gap: 14 }}>
          <h3 style={{ margin: "4px 0 0", fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Certificate details</h3>

          <label className={styles.field}>
            <span>Artwork title</span>
            <input value={cfg.title} onChange={(event) => set("title", event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Artist</span>
            <input value={cfg.artist} onChange={(event) => set("artist", event.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className={styles.field}>
              <span>Year</span>
              <input value={cfg.year} onChange={(event) => set("year", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Dimensions</span>
              <input value={cfg.dimensions} onChange={(event) => set("dimensions", event.target.value)} />
            </label>
          </div>
          <label className={styles.field}>
            <span>Medium</span>
            <input value={cfg.medium} onChange={(event) => set("medium", event.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className={styles.field}>
              <span>Edition number</span>
              <input inputMode="numeric" value={cfg.editionNumber} onChange={(event) => set("editionNumber", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Edition size</span>
              <input inputMode="numeric" value={cfg.editionSize} onChange={(event) => set("editionSize", event.target.value)} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className={styles.field}>
              <span>Date of issue</span>
              <input type="date" value={cfg.issueDate} onChange={(event) => set("issueDate", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Place of issue</span>
              <input value={cfg.place} onChange={(event) => set("place", event.target.value)} />
            </label>
          </div>

          <label className={styles.field}>
            <span>Certificate ID</span>
            <span style={{ display: "flex", gap: 8 }}>
              <input value={cfg.certificateId} onChange={(event) => set("certificateId", event.target.value)} style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="editor-secondary-button" onClick={() => set("certificateId", generateCertificateId())}>
                New ID
              </button>
            </span>
          </label>

          <label className={styles.field}>
            <span>Signature — typed name as it appears above the line</span>
            <input
              value={cfg.signatureText}
              placeholder="Type your signature, e.g. Kabeya Ilunga"
              onChange={(event) => set("signatureText", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Signed by (printed name under the line)</span>
            <input value={cfg.signatureName} onChange={(event) => set("signatureName", event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Verification note</span>
            <textarea
              value={cfg.verificationNote}
              rows={3}
              onChange={(event) => set("verificationNote", event.target.value)}
              style={{ padding: "10px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--paper)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
            />
          </label>

          <h3 style={{ margin: "12px 0 0", fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Design</h3>
          <label className={styles.field}>
            <span>Template</span>
            <select value={cfg.template} onChange={(event) => set("template", event.target.value as TemplateId)}>
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.blurb}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className={styles.field}>
              <span>Paper size</span>
              <select value={cfg.paperSize} onChange={(event) => set("paperSize", event.target.value as PaperSize)}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Orientation</span>
              <select value={cfg.orientation} onChange={(event) => set("orientation", event.target.value as Orientation)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className={styles.field}>
              <span>Border / frame</span>
              <select value={cfg.border} onChange={(event) => set("border", event.target.value as BorderStyle)}>
                <option value="double">Double rule</option>
                <option value="single">Single rule</option>
                <option value="gold">Gold rule</option>
                <option value="none">None</option>
              </select>
            </label>
            <span className={styles.field}>
              <span>Accents</span>
              <span style={{ display: "flex", gap: 16, alignItems: "center", minHeight: 40 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 400, color: "var(--ink)" }}>
                  <input type="checkbox" checked={cfg.goldAccent} onChange={(event) => set("goldAccent", event.target.checked)} /> Gold accent
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 400, color: "var(--ink)" }}>
                  <input type="checkbox" checked={cfg.showImage} disabled={!cfg.imageUrl} onChange={(event) => set("showImage", event.target.checked)} /> Show artwork image
                </label>
              </span>
            </span>
          </div>
          {!cfg.imageUrl && (
            <p style={{ margin: 0, color: "#666", fontSize: 12 }}>This artwork has no image uploaded yet, so the certificate prints without one. Add an image in the editor to include it.</p>
          )}
        </div>

        {/* -- Live preview -------------------------------------------------- */}
        <div>
          <p style={{ margin: "4px 0 10px", color: "#666", fontSize: 12 }}>
            Live preview — {template.name} · {cfg.paperSize} {cfg.orientation}. What you see here is what prints, on one page.
          </p>
          <div className="cert-print-sheet" style={sheetStyle}>
            <p className={styles.certificateKicker} style={{ color: accent }}>
              CERTIFICATE OF AUTHENTICITY
            </p>

            {cfg.template === "gallery" && cfg.showImage && cfg.imageUrl && (
              <img src={cfg.imageUrl} alt={cfg.title} style={{ width: "100%", maxHeight: 220, objectFit: "contain", margin: "0 0 16px" }} />
            )}

            <h2
              style={{
                margin: "0 0 6px",
                fontFamily: SERIF,
                fontSize: cfg.template === "minimal" ? 26 : 30,
                fontWeight: 600,
                lineHeight: 1.15,
              }}
            >
              {cfg.title || "Untitled"}
            </h2>
            <p className={styles.certificateArtist} style={{ margin: cfg.template === "minimal" ? "0 0 18px" : "0 0 28px" }}>
              {cfg.artist}
            </p>

            {cfg.template !== "gallery" && cfg.showImage && cfg.imageUrl && (
              <img src={cfg.imageUrl} alt={cfg.title} style={{ width: "100%", maxHeight: 150, objectFit: "contain", margin: "0 0 18px" }} />
            )}

            <dl className={styles.certificateDetails} style={cfg.template === "minimal" ? { borderTop: `1px solid ${accent}` } : undefined}>
              <div>
                <dt>Medium</dt>
                <dd>{cfg.medium || "—"}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{cfg.dimensions || "—"}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{cfg.year || "—"}</dd>
              </div>
              <div>
                <dt>Edition</dt>
                <dd>{editionLabel(cfg)}</dd>
              </div>
              <div>
                <dt>Certificate ID</dt>
                <dd>{cfg.certificateId}</dd>
              </div>
            </dl>

            <p className={styles.certificateText} style={{ textAlign: cfg.template === "minimal" ? "left" : "center" }}>
              This document certifies that the work described above is an original work by {cfg.artist}, issued in {cfg.place} on{" "}
              {formatIssueDate(cfg.issueDate)}.
            </p>

            <div style={{ marginTop: "auto" }}>
              <div className={styles.certificateSign} style={{ marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  {cfg.signatureText ? (
                    <span style={{ display: "block", fontFamily: SERIF, fontStyle: "italic", fontSize: 24, lineHeight: 1.2, minHeight: 30 }}>
                      {cfg.signatureText}
                    </span>
                  ) : (
                    <span className={styles.signatureLine} style={{ height: 30, background: "transparent" }} />
                  )}
                  <span className={styles.signatureLine} />
                  <p>{cfg.signatureName} — Artist</p>
                </div>
                <div style={{ flex: 1 }}>
                  <span className={styles.signatureLine} style={{ height: 30, background: "transparent" }} />
                  <span className={styles.signatureLine} />
                  <p>
                    {cfg.place} — {formatIssueDate(cfg.issueDate)}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", textAlign: "left" }}>
                <p style={{ margin: 0, color: "#666", fontSize: 11, lineHeight: 1.5, flex: 1 }}>
                  {cfg.verificationNote}
                  <br />
                  <strong style={{ color: INK }}>Certificate ID: {cfg.certificateId}</strong>
                </p>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  {qrError ? (
                    <p style={{ margin: 0, fontSize: 11, color: "#666", maxWidth: 132 }}>QR unavailable — verify with the certificate ID above.</p>
                  ) : (
                    <>
                      <canvas ref={qrRef} width={132} height={132} style={{ width: 88, height: 88, display: "block" }} aria-label={`QR code for certificate ${cfg.certificateId}`} />
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: "#666" }}>Scan to verify</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -- How verification works (honest, no invented service) ------------ */}
      <div style={{ marginTop: 32, padding: 20, border: "1px solid var(--line)", borderRadius: 8, background: "var(--room-color)" }}>
        <h3 style={{ margin: "0 0 8px", fontFamily: SERIF, fontSize: 17, fontWeight: 600 }}>How anyone verifies this certificate</h3>
        <p style={{ margin: "0 0 8px", color: "#444", fontSize: 13, lineHeight: 1.6 }}>
          There is no automatic online verification service for these certificates. A buyer or collector checks the certificate in two ways:
          scan the QR code, which carries the certificate ID, the artwork title and the artist&apos;s name — or read the certificate ID printed
          on the certificate and compare it with the artist&apos;s own records (your issued list on this page) and with the artwork itself:
          title, medium, dimensions, year and edition must match. When in doubt, the holder should contact the artist directly and quote the
          certificate ID.
        </p>
        <p style={{ margin: 0, color: "#444", fontSize: 13, lineHeight: 1.6 }}>
          Export is through your browser: “Print / save as PDF” opens the print dialog, where you choose “Save as PDF”. The certificate prints
          on one page, in the paper size and orientation chosen above.
        </p>
      </div>

      {/* -- Issued certificates -------------------------------------------- */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ margin: "0 0 4px", fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Issued certificates</h3>
        <p style={{ margin: "0 0 14px", color: "#666", fontSize: 13 }}>
          Every certificate you issue is saved here. Open one to edit or reprint it; revoking removes it from this list.
        </p>
        {savedLoading && <p style={{ color: "#666", fontSize: 13 }}>Loading your issued certificates…</p>}
        {savedError && (
          <p role="alert" style={{ color: "#8a2f2f", fontSize: 13 }}>
            {savedError}
          </p>
        )}
        {!savedLoading && !savedError && saved.length === 0 && (
          <div className={styles.emptyBox}>
            <strong>No certificates issued yet.</strong>
            <p>Fill in the details above and choose “Issue certificate” — it will appear here, ready to reprint.</p>
          </div>
        )}
        {saved.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {saved.map((row) => {
              const data = row.data as Partial<CertificateConfig>;
              const certId = typeof data.certificateId === "string" ? data.certificateId : "";
              const issued = new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
              const confirming = confirmDeleteId === row.id;
              return (
                <li
                  key={row.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: loadedId === row.id ? "var(--room-color)" : "#fff",
                  }}
                >
                  <div style={{ minWidth: 200 }}>
                    <strong style={{ display: "block", fontSize: 14 }}>{row.title}</strong>
                    <span style={{ color: "#666", fontSize: 12 }}>
                      Issued {issued}
                      {certId ? ` · ${certId}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="editor-secondary-button" onClick={() => loadSaved(row)}>
                      View
                    </button>
                    <button type="button" className="editor-secondary-button" onClick={() => reprintSaved(row)}>
                      Reprint
                    </button>
                    {confirming ? (
                      <>
                        <button
                          type="button"
                          className="editor-secondary-button"
                          disabled={deletingId === row.id}
                          onClick={() => revokeSaved(row)}
                          style={{ borderColor: "#8a2f2f", color: "#8a2f2f" }}
                        >
                          {deletingId === row.id ? "Revoking…" : "Confirm revoke"}
                        </button>
                        <button type="button" className="editor-secondary-button" onClick={() => setConfirmDeleteId(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button type="button" className="editor-secondary-button" onClick={() => setConfirmDeleteId(row.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

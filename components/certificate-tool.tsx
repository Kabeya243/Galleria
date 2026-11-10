"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import BrandLogo from "@/components/brand-logo";
import { convert, formatCurrency, formatRateDate } from "@/lib/currency";
import { archiveToolDocument, deleteToolArchive } from "@/lib/tool-archive";
import { useExchangeRates } from "@/lib/use-exchange-rates";
import styles from "./tools.module.css";
import "./certificate-tool.css";

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
// Certificate Studio — redesigned on the Atelier editor's visual language
// (SANAA dark/gold theme: charcoal panels, off-white text, restrained gold
// accent, Manrope; see components/certificate-tool.css, scoped under
// .certificate-scope like .atelier-scope). Same certificate data as before
// — artwork, artist, dimensions, date, signature — only the chrome
// around it changed.
//
// Saving is twofold, like Atelier designs:
//   1. the database, via /api/saved-work (kind "certificate") — the
//      issued list on this page, open / reprint / revoke;
//   2. the R2 archive, via /api/tool-archives — a JSON copy at
//      certificates/<userId>/<id>.json in the « sanaa » bucket, the same
//      mechanism as Atelier designs at atelier/projects/<userId>/<id>.json.
//      (The Python function api/index.py renders exports; it never
//      persists anything — the archive lives in the Next.js route, as
//      Atelier's own save does.)
// Export is a real one-page PDF from that same Python function
// (POST /api/atelier/export/certificate); the browser print dialog
// stays available as before. All errors are shown inline, never in a
// browser alert dialog.
// ---------------------------------------------------------------------------

type TemplateId =
  | "classic"
  | "minimal"
  | "gallery"
  | "heritage"
  | "modern"
  | "noir"
  | "deco"
  | "monogram"
  | "ledger"
  | "ribbon";
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
  // Sale price in US dollars (optional, typed by the artist): shown on the
  // certificate in USD and converted into the buyer's currencies. Empty
  // means no price is printed.
  priceUsd: string;
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

// Ten original certificate designs, drawn for artworks — no copies of
// existing certificate layouts. Each one is a distinct composition:
// alignment, paper tone, rule, ornament and detail layout differ.
type TemplateMeta = {
  id: TemplateId;
  name: string;
  blurb: string;
  align: "center" | "left";
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  ornament: "none" | "corners" | "topbar" | "band" | "diamonds" | "watermark" | "ruled" | "seal";
  details: "stack" | "grid";
  kickerSpacing: string;
  titleSize: number;
};

const TEMPLATES: TemplateMeta[] = [
  { id: "classic", name: "Classic", blurb: "Centred, formal, double rule: the traditional certificate.", align: "center", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#8a6d2b", ornament: "none", details: "stack", kickerSpacing: "0.22em", titleSize: 30 },
  { id: "minimal", name: "Minimal", blurb: "Quiet and spare: small type, wide margins, one thin rule.", align: "left", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#1a1a1a", ornament: "none", details: "stack", kickerSpacing: "0.18em", titleSize: 26 },
  { id: "gallery", name: "Gallery", blurb: "The work leads: large image, generous title, gallery-label details.", align: "center", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#8a6d2b", ornament: "none", details: "stack", kickerSpacing: "0.22em", titleSize: 30 },
  { id: "heritage", name: "Heritage", blurb: "Warm ivory paper, double gold rule, corner flourishes and a wax seal.", align: "center", bg: "#faf6ec", ink: "#2b2416", muted: "#7a6a45", accent: "#8a6d2b", ornament: "corners", details: "stack", kickerSpacing: "0.3em", titleSize: 30 },
  { id: "modern", name: "Modern", blurb: "Left-aligned, thick black top bar, bold grotesque type, details in two columns.", align: "left", bg: "#ffffff", ink: "#111111", muted: "#555555", accent: "#111111", ornament: "topbar", details: "grid", kickerSpacing: "0.2em", titleSize: 32 },
  { id: "noir", name: "Atelier Noir", blurb: "Charcoal sheet, gold type: the certificate as a dark gallery wall.", align: "center", bg: "#141210", ink: "#f5f2eb", muted: "#c9b896", accent: "#c9a86a", ornament: "none", details: "stack", kickerSpacing: "0.3em", titleSize: 30 },
  { id: "deco", name: "Deco", blurb: "A row of gold diamonds, wide letterspacing, double rule: geometry, not clutter.", align: "center", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#b08d3e", ornament: "diamonds", details: "stack", kickerSpacing: "0.34em", titleSize: 30 },
  { id: "monogram", name: "Monogram", blurb: "The artist's initial as a pale watermark behind the title, hairline frame.", align: "center", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#8a6d2b", ornament: "watermark", details: "stack", kickerSpacing: "0.22em", titleSize: 30 },
  { id: "ledger", name: "Ledger", blurb: "An archival ledger: ruled lines, typewriter details, an ORIGINAL stamp box.", align: "left", bg: "#fbfaf6", ink: "#22201a", muted: "#6b6558", accent: "#22201a", ornament: "ruled", details: "stack", kickerSpacing: "0.12em", titleSize: 26 },
  { id: "ribbon", name: "Ribbon", blurb: "A gold band across the top and a seal circle: the certificate as an award.", align: "center", bg: "#fdfdfc", ink: "#1a1a1a", muted: "#666666", accent: "#b08d3e", ornament: "band", details: "stack", kickerSpacing: "0.22em", titleSize: 30 },
];

const TEMPLATE_IDS = TEMPLATES.map((item) => item.id) as TemplateId[];
const GOLD = "#b08d3e";
const INK = "#1a1a1a";
const SERIF = '"Fraunces", Georgia, serif';
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const DEFAULT_VERIFICATION_NOTE =
  "This certificate accompanies the original work described above. Verify it online: scan the QR code, or enter the certificate ID on the Lakisa certificate verification page.";

// The note printed on certificates issued before the online
// verification service existed. configFromSaved replaces it with the
// new default (the QR code now points to the verification page); a
// custom note written by the artist is kept as-is.
const LEGACY_VERIFICATION_NOTE =
  "This certificate accompanies the original work described above. To check it, compare the certificate ID printed here with the artist's own records, or scan the QR code, which carries the certificate ID, the work's title and the artist's name.";

// The verification URL a QR code points to. The origin comes from the
// browser (window.location.origin), so the same code works on every
// deployment; the ID is upper-cased and encoded, matching the lookup.
function verificationUrl(cfg: CertificateConfig, origin: string): string {
  return `${origin.replace(/\/$/, "")}/verify?id=${encodeURIComponent(cfg.certificateId.trim().toUpperCase())}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateCertificateId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `LAKISA-${new Date().getFullYear()}-${suffix}`;
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
    priceUsd: "",
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

// A blank certificate, fillable by hand: used when there are no
// artworks at all, and when the artist picks "No artwork" in the
// picker. Same defaults as a fresh artwork certificate, only the
// artwork fields start empty.
function configForBlank(artistName: string): CertificateConfig {
  return {
    artworkId: "",
    title: "",
    artist: artistName,
    year: "",
    medium: "",
    dimensions: "",
    imageUrl: null,
    editionNumber: "1",
    editionSize: "1",
    priceUsd: "",
    issueDate: todayIso(),
    place: "Kampala, Uganda",
    signatureName: artistName,
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
  if (!TEMPLATE_IDS.includes(merged.template)) merged.template = "classic";
  if (!["A4", "Letter"].includes(merged.paperSize)) merged.paperSize = "A4";
  if (!["portrait", "landscape"].includes(merged.orientation)) merged.orientation = "portrait";
  if (!["none", "single", "double", "gold"].includes(merged.border)) merged.border = "double";
  if (typeof merged.priceUsd !== "string") merged.priceUsd = "";
  // Certificates issued before the online verification service carry
  // the old note. The QR code now points to the verification page, so
  // the old note is wrong, so replace it with the new default, unless
  // the artist wrote their own note (a custom note is kept as-is).
  if (
    typeof merged.verificationNote !== "string" ||
    merged.verificationNote.trim() === "" ||
    merged.verificationNote === LEGACY_VERIFICATION_NOTE
  ) {
    merged.verificationNote = DEFAULT_VERIFICATION_NOTE;
  }
  return merged;
}

function editionLabel(cfg: CertificateConfig): string {
  const n = cfg.editionNumber.trim() || "1";
  const size = cfg.editionSize.trim() || "1";
  return size === "1" ? `${n} / 1: unique work` : `No. ${n} of ${size}`;
}

// Faithful miniature of one certificate template: the same composition
// as the live preview, at thumbnail scale — ornament, alignment,
// details layout and paper / ink / accent colours all come from the
// template itself, so the ten designs are told apart at a glance.
function TemplateMini({ item }: { item: TemplateMeta }) {
  const titleWidth = Math.round(20 + item.titleSize * 0.45);
  const left = item.align === "left";
  const kicker = (
    <span className="mini-kicker" style={{ background: item.accent, width: item.id === "minimal" ? 14 : 20 }} />
  );
  const title = <span className="mini-title" style={{ background: item.ink, width: titleWidth }} />;
  const line = (width: number, key: string) => (
    <span key={key} className="mini-line" style={{ background: item.muted, width }} />
  );
  const stack = (
    <>
      {line(26, "l1")}
      {line(18, "l2")}
    </>
  );
  const grid = (
    <span className="mini-cols">
      <span className="mini-col">
        {line(16, "g1")}
        {line(12, "g2")}
      </span>
      <span className="mini-col">
        {line(16, "g3")}
        {line(12, "g4")}
      </span>
    </span>
  );
  return (
    <span className="cert-tpl-mini" style={{ background: item.bg }}>
      {item.ornament === "topbar" && <span className="mini-topbar" style={{ background: item.ink }} />}
      {item.ornament === "band" && <span className="mini-band" style={{ background: item.accent }} />}
      {item.ornament === "diamonds" && (
        <span className="mini-diamonds">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ background: item.accent }} />
          ))}
        </span>
      )}
      {item.ornament === "corners" && (
        <>
          <span className="mini-frame" style={{ borderColor: item.accent }} />
          <span className="mini-frame inner" style={{ borderColor: item.accent }} />
          <span className="mini-corner tl" style={{ borderColor: item.accent }} />
          <span className="mini-corner tr" style={{ borderColor: item.accent }} />
          <span className="mini-corner bl" style={{ borderColor: item.accent }} />
          <span className="mini-corner br" style={{ borderColor: item.accent }} />
        </>
      )}
      {item.ornament === "watermark" && (
        <span className="mini-watermark" style={{ color: item.ink }}>
          A
        </span>
      )}
      {item.id === "noir" && <span className="mini-frame" style={{ borderColor: item.accent, opacity: 0.45 }} />}
      {item.id === "monogram" && <span className="mini-frame" style={{ borderColor: item.ink, opacity: 0.4 }} />}
      <span className={`cert-tpl-mini-body${left ? " left" : ""}`}>
        {item.id === "gallery" && (
          <span className="mini-img" style={{ background: `${item.ink}14`, borderColor: `${item.ink}33` }} />
        )}
        {kicker}
        {title}
        {item.id === "minimal" ? (
          <>
            <span className="mini-rule" style={{ background: item.accent }} />
            {line(22, "m1")}
          </>
        ) : item.ornament === "ruled" ? (
          <>
            <span className="mini-ruled" style={{ background: item.muted }} />
            <span className="mini-ruled" style={{ background: item.muted }} />
          </>
        ) : item.details === "grid" ? (
          grid
        ) : (
          stack
        )}
        {(item.id === "classic" || item.id === "deco") && (
          <span className="mini-double-rule" style={{ borderColor: item.accent }} />
        )}
        {(item.id === "heritage" || item.id === "ribbon") && (
          <span className="mini-seal" style={{ background: item.accent }} />
        )}
      </span>
      {item.id === "ledger" && (
        <span className="mini-stamp" style={{ borderColor: item.ink, color: item.ink }}>
          ORIGINAL
        </span>
      )}
    </span>
  );
}

export default function CertificateTool({
  artistName,
  artworks,
}: {
  artistName: string;
  artworks: CertificateArtwork[];
}) {
  const firstArtwork = artworks[0];
  const [cfg, setCfg] = useState<CertificateConfig | null>(() =>
    firstArtwork ? configForArtwork(firstArtwork, artistName) : configForBlank(artistName),
  );
  const [saved, setSaved] = useState<SavedCertificate[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // R2 archive state: which issued ids also have a JSON copy in the
  // user's bucket (certificates/<userId>/<id>.json). null = unknown
  // (archive not configured or not yet checked).
  const [archivedIds, setArchivedIds] = useState<Set<string> | null>(null);
  const [archiveNote, setArchiveNote] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const [qrError, setQrError] = useState(false);
  // Site origin for the verification URL the QR code points to. Set
  // after mount (window is not available during server rendering); the
  // QR is drawn once it is known, via the payload below.
  const [verifyOrigin, setVerifyOrigin] = useState("");
  useEffect(() => {
    setVerifyOrigin(window.location.origin);
  }, []);
  // Sheet fit: the live preview is scaled down (never up) so the whole
  // studio fits the viewport without scrolling — see the effect below.
  const scalerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetScale, setSheetScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const rates = useExchangeRates();

  // The sale price as a whole number of US dollars, or null when the field
  // is empty or not a number — then no price is printed at all.
  const priceNumber = useMemo(() => {
    if (!cfg) return null;
    const parsed = Number(cfg.priceUsd);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }, [cfg?.priceUsd]);

  const selectedArtwork = useMemo(
    () =>
      cfg?.artworkId
        ? (artworks.find((artwork) => artwork.id === cfg.artworkId) ?? firstArtwork)
        : undefined,
    [artworks, cfg?.artworkId, firstArtwork],
  );

  // Load issued certificates + which of them are archived in R2.
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
      try {
        const res = await fetch("/api/tool-archives?kind=certificate");
        if (res.ok) {
          const json = (await res.json()) as { ids?: string[]; configured?: boolean };
          if (!cancelled) setArchivedIds(json.configured === false ? null : new Set(json.ids ?? []));
        }
      } catch {
        if (!cancelled) setArchivedIds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The QR code points to the public verification page for this
  // certificate (/verify?id=…). Empty until the origin is known (after
  // mount); the QR effect below redraws once it is set.
  const payload = cfg && verifyOrigin ? verificationUrl(cfg, verifyOrigin) : "";
  useEffect(() => {
    const canvas = qrRef.current;
    if (!canvas || !payload) return;
    QRCode.toCanvas(canvas, payload, {
      width: 132,
      margin: 1,
      color: { dark: INK, light: "#ffffff" },
    }).catch(() => setQrError(true));
  }, [payload]);

  // Fit the sheet inside the workspace on desktop: measure the space
  // the workspace actually gives the sheet and scale the sheet down
  // (never up) so it fits without the workspace scrolling. The sheet's
  // layout size is fixed by its aspect ratio, so a transform scale is
  // enough — the wrapper is given the scaled height so no empty space
  // is left behind. Below 900 px the columns stack and the sheet keeps
  // its natural size (scale 1, no wrapper height).
  useEffect(() => {
    const scaler = scalerRef.current;
    const sheet = sheetRef.current;
    if (!scaler || !sheet) return;
    const measure = () => {
      if (!window.matchMedia("(min-width: 901px)").matches) {
        setSheetScale(1);
        setSheetHeight(0);
        return;
      }
      const naturalW = sheet.offsetWidth;
      const naturalH = sheet.offsetHeight;
      const availW = scaler.clientWidth;
      const availH = scaler.clientHeight;
      if (!naturalW || !naturalH || !availW || !availH) return;
      setSheetHeight(naturalH);
      setSheetScale(Math.min(1, availW / naturalW, availH / naturalH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scaler);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  // The form is always visible, even with no artworks: cfg starts as a
  // blank certificate then, so there is nothing to wait for here.
  if (!cfg) {
    return (
      <div className="certificate-scope">
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Add a work in the editor first, a certificate needs a real piece behind it.</p>
        </div>
      </div>
    );
  }

  const set = <K extends keyof CertificateConfig>(key: K, value: CertificateConfig[K]) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
    setIssueMsg(null);
    setIssueError(null);
  };

  const pickArtwork = (artworkId: string) => {
    if (!artworkId) {
      // "No artwork": detach from the artwork but keep what the artist
      // already typed by hand, only the image goes away with it.
      setCfg((prev) => (prev ? { ...prev, artworkId: "", imageUrl: null } : prev));
      setLoadedId(null);
      setIssueMsg(null);
      setIssueError(null);
      return;
    }
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
    setCfg(selectedArtwork ? configForArtwork(selectedArtwork, artistName) : configForBlank(artistName));
    setLoadedId(null);
    setIssueMsg(null);
    setIssueError(null);
  };

  const issueCertificate = async (asNew: boolean) => {
    setSaving(true);
    setIssueMsg(null);
    setIssueError(null);
    setArchiveNote(null);
    try {
      let row: SavedCertificate;
      if (asNew || !loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "certificate",
            title: `${cfg.title}: ${cfg.certificateId}`,
            data: cfg,
            artworkId: cfg.artworkId || undefined,
          }),
        });
        if (!res.ok) throw new Error("Could not issue the certificate. Sign in and try again.");
        const json = (await res.json()) as { saved: SavedCertificate };
        row = json.saved;
        setSaved((prev) => [row, ...prev]);
        setLoadedId(row.id);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title: `${cfg.title}: ${cfg.certificateId}`, data: cfg }),
        });
        if (!res.ok) throw new Error("Could not update the saved certificate.");
        const json = (await res.json()) as { saved: SavedCertificate };
        row = json.saved;
        setSaved((prev) => prev.map((item) => (item.id === loadedId ? row : item)));
      }
      // Second half of the save: the R2 archive copy, same mechanism as
      // Atelier designs. Best-effort — the database save above already
      // succeeded, so an archive failure only adds an inline note.
      const archived = await archiveToolDocument("certificate", row.id, { ...cfg, title: cfg.title });
      if (archived.archived) {
        setArchivedIds((prev) => new Set([...(prev ?? []), row.id]));
        setArchiveNote("Archived in your account (R2).");
      } else {
        setArchiveNote(
          archived.reason === "archive-unavailable"
            ? "Saved in your account. The file archive is not configured, so no R2 copy was made."
            : "Saved in your account. The file archive copy could not be made, try again later.",
        );
      }
      setIssueMsg(
        asNew || !loadedId
          ? `Issued as ${cfg.certificateId}. It is now in your issued list below, download the PDF or print it.`
          : `Saved changes to ${cfg.certificateId}.`,
      );
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Could not save the certificate.");
    } finally {
      setSaving(false);
    }
  };

  const loadSaved = (row: SavedCertificate) => {
    const found = row.artworkId ? artworks.find((item) => item.id === row.artworkId) : undefined;
    const fallback = found
      ? configForArtwork(found, artistName)
      : (cfg ?? configForBlank(artistName));
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
      // Remove the R2 archive copy too, so nothing lingers.
      await deleteToolArchive("certificate", row.id);
      setArchivedIds((prev) => {
        if (!prev) return prev;
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      setSaved((prev) => prev.filter((item) => item.id !== row.id));
      if (loadedId === row.id) {
        setLoadedId(null);
        newCertificate();
      }
      setConfirmDeleteId(null);
      setIssueMsg(`Revoked ${row.title}. It no longer appears in your issued list, tell anyone holding a printed copy directly, as paper already handed out cannot be recalled from here.`);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Could not revoke the certificate.");
    } finally {
      setDeletingId(null);
    }
  };

  const downloadPdf = async () => {
    setExportingPdf(true);
    setIssueMsg(null);
    setIssueError(null);
    try {
      // The PDF is rendered server-side (Python); the verification URL
      // travels with the config so the printed QR code points to the
      // same public verification page as the on-screen QR. It is not
      // part of the saved config, only of this export request.
      const res = await fetch("/api/atelier/export/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cfg,
          ...(verifyOrigin ? { verifyUrl: verificationUrl(cfg, verifyOrigin) } : {}),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(json?.detail ?? "Could not create the PDF. Sign in and try again.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${cfg.certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setIssueMsg(`PDF downloaded as ${cfg.certificateId}.pdf, one page, in the template and paper size shown above.`);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Could not create the PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // -- Preview styling: per-template paper, ink and ornament ---------------
  const template = TEMPLATES.find((item) => item.id === cfg.template) ?? TEMPLATES[0];
  const isLandscape = cfg.orientation === "landscape";
  const paperRatio = cfg.paperSize === "A4" ? (isLandscape ? 297 / 210 : 210 / 297) : isLandscape ? 11 / 8.5 : 8.5 / 11;
  const accent = cfg.goldAccent ? template.accent : template.ink;
  const frameColor = cfg.border === "gold" ? (cfg.goldAccent ? GOLD : template.ink) : template.ink;
  const borderStyle =
    cfg.border === "none"
      ? `1px solid ${template.ink}22`
      : cfg.border === "single"
        ? `1px solid ${frameColor}`
        : cfg.border === "double"
          ? `4px double ${frameColor}`
          : `1px solid ${frameColor}`;
  const sheetStyle: React.CSSProperties = {
    maxWidth: isLandscape ? 820 : 640,
    width: "100%",
    margin: "0 auto",
    padding: "clamp(22px, 5vw, 52px) clamp(20px, 6vw, 56px)",
    border: borderStyle,
    background: template.bg,
    color: template.ink,
    textAlign: template.align,
    aspectRatio: `${paperRatio}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  };

  const watermarkInitial = (cfg.artist.trim() || "A").charAt(0).toUpperCase();

  const printCss = `
@media print {
  @page { size: ${cfg.paperSize} ${cfg.orientation}; margin: 0; }
  body * { visibility: hidden !important; }
  .cert-print-sheet, .cert-print-sheet * { visibility: visible !important; }
  .cert-print-sheet {
    position: absolute !important; left: 0; top: 0; width: 100% !important;
    max-width: none !important; aspect-ratio: auto !important; margin: 0 !important;
    min-height: 100%; box-shadow: none !important; transform: none !important;
  }
  /* The screen-only fit (fixed layout height, scaled sheet, scrolling
     panel) must not constrain the printed page. */
  .cert-layout { height: auto !important; min-height: 0 !important; }
  .cert-panel { overflow: visible !important; }
  .cert-workspace { overflow: visible !important; }
  .cert-sheet-scaler { height: auto !important; overflow: visible !important; }
}
`;

  return (
    <div className="certificate-scope">
      {/* Print stylesheet: only the certificate sheet prints, on one page. */}
      <style>{printCss}</style>

      {/* -- Topbar (Atelier language: brand, title, save status, actions) -- */}
      <header className="cert-topbar">
        <span className="cert-brand">
          <BrandLogo variant="icon" height={36} />
          LAKISA
        </span>
        <span className="cert-top-divider" />
        <div className="cert-title-wrap">
          <strong>Certificate Studio</strong>
          <span>
            {cfg.certificateId} · {template.name} · {cfg.paperSize} {cfg.orientation}
            {loadedId ? " · editing a saved certificate" : ""}
          </span>
        </div>
        <div className="cert-top-actions">
          <button type="button" className="cert-button-save" onClick={() => issueCertificate(false)} disabled={saving}>
            {saving ? "Saving…" : loadedId ? "Update saved certificate" : "Issue certificate"}
          </button>
          {loadedId && (
            <button type="button" className="cert-button" onClick={() => issueCertificate(true)} disabled={saving}>
              Issue as new
            </button>
          )}
          <button type="button" className="cert-button" onClick={downloadPdf} disabled={exportingPdf}>
            {exportingPdf ? "Making PDF…" : "Download PDF"}
          </button>
          <button type="button" className="cert-button" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="cert-button" onClick={newCertificate}>
            New
          </button>
        </div>
      </header>

      {issueMsg && (
        <p role="status" className="cert-msg cert-msg-ok">
          {issueMsg}
          {archiveNote ? ` ${archiveNote}` : ""}
        </p>
      )}
      {issueError && (
        <p role="alert" className="cert-msg cert-msg-error">
          {issueError}
        </p>
      )}

      <div className="cert-layout">
        {/* -- Field editor (left panel) ------------------------------------- */}
        <aside className="cert-panel">
          <div className="cert-panel-section">
            <p className="cert-eyebrow">CHOOSE</p>
            <h3>Artwork</h3>
            <label className={styles.field}>
              <span>Artwork</span>
              <select value={cfg.artworkId} onChange={(event) => pickArtwork(event.target.value)}>
                <option value="">No artwork (blank certificate)</option>
                {artworks.map((artwork) => (
                  <option key={artwork.id} value={artwork.id}>
                    {artwork.title} ({artwork.year})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="cert-panel-section">
            <p className="cert-eyebrow">DETAILS</p>
            <h3>Certificate details</h3>
            <label className={styles.field}>
              <span>Artwork title</span>
              <input value={cfg.title} onChange={(event) => set("title", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Artist</span>
              <input value={cfg.artist} onChange={(event) => set("artist", event.target.value)} />
            </label>
            <div className="cert-field-row">
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
            <label className={styles.field}>
              <span>Sale price (USD, optional)</span>
              <input
                inputMode="decimal"
                placeholder="e.g. 1500, leave empty to print no price"
                value={cfg.priceUsd}
                onChange={(event) => set("priceUsd", event.target.value)}
              />
            </label>
            <div className="cert-field-row">
              <label className={styles.field}>
                <span>Edition number</span>
                <input inputMode="numeric" value={cfg.editionNumber} onChange={(event) => set("editionNumber", event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Edition size</span>
                <input inputMode="numeric" value={cfg.editionSize} onChange={(event) => set("editionSize", event.target.value)} />
              </label>
            </div>
            <div className="cert-field-row">
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
              <span className="cert-id-row">
                <input value={cfg.certificateId} onChange={(event) => set("certificateId", event.target.value)} />
                <button type="button" className="cert-button" onClick={() => set("certificateId", generateCertificateId())}>
                  New ID
                </button>
              </span>
            </label>
            <label className={styles.field}>
              <span>Signature: typed name as it appears above the line</span>
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
                className="cert-textarea"
              />
            </label>
          </div>

          <div className="cert-panel-section">
            <p className="cert-eyebrow">DESIGN</p>
            <h3>Template: 10 original designs</h3>
            <div className="cert-tpl-grid">
              {TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cert-tpl ${cfg.template === item.id ? "active" : ""}`}
                  onClick={() => set("template", item.id)}
                  aria-pressed={cfg.template === item.id}
                >
                  <TemplateMini item={item} />
                  <span className="cert-tpl-name">{item.name}</span>
                  <span className="cert-tpl-blurb">{item.blurb}</span>
                </button>
              ))}
            </div>
            <div className="cert-field-row">
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
            <div className="cert-field-row">
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
                <span className="cert-checks">
                  <label>
                    <input type="checkbox" checked={cfg.goldAccent} onChange={(event) => set("goldAccent", event.target.checked)} /> Gold accent
                  </label>
                  <label>
                    <input type="checkbox" checked={cfg.showImage} disabled={!cfg.imageUrl} onChange={(event) => set("showImage", event.target.checked)} /> Show artwork image
                  </label>
                </span>
              </span>
            </div>
            {!cfg.imageUrl && (
              <p className="cert-hint">This artwork has no image uploaded yet, so the certificate prints without one. Add an image in the editor to include it.</p>
            )}
          </div>
        </aside>

        {/* -- Live preview (workspace) ---------------------------------------- */}
        <section className="cert-workspace">
          <p className="cert-workspace-hint">
            Live preview: {template.name} · {cfg.paperSize} {cfg.orientation}. What you see here is what prints and what the PDF contains, on one page.
          </p>
          <div
            className="cert-sheet-scaler"
            ref={scalerRef}
            style={sheetHeight ? { height: Math.max(1, Math.round(sheetHeight * sheetScale)) } : undefined}
          >
          <div
            className="cert-print-sheet"
            ref={sheetRef}
            style={{
              ...sheetStyle,
              paddingTop: template.ornament === "band" ? 84 : sheetStyle.paddingTop,
              transform: sheetScale === 1 ? undefined : `scale(${sheetScale})`,
              transformOrigin: "top center",
            }}
          >
            {template.ornament === "band" && <div className="cert-orn-band" style={{ background: accent }} />}
            {template.ornament === "corners" && (
              <>
                <span className="cert-orn-corner tl" style={{ borderColor: accent }} />
                <span className="cert-orn-corner tr" style={{ borderColor: accent }} />
                <span className="cert-orn-corner bl" style={{ borderColor: accent }} />
                <span className="cert-orn-corner br" style={{ borderColor: accent }} />
              </>
            )}
            {template.ornament === "watermark" && (
              <span className="cert-orn-watermark" style={{ color: template.ink }}>
                {watermarkInitial}
              </span>
            )}
            {template.ornament === "topbar" && <div className="cert-orn-topbar" style={{ background: template.ink }} />}
            {template.ornament === "diamonds" && (
              <div className="cert-orn-diamonds">
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ background: accent }} />
                ))}
              </div>
            )}

            <p
              className="cert-kicker"
              style={{ color: template.ornament === "band" ? "#fdfdfc" : accent, letterSpacing: template.kickerSpacing }}
            >
              CERTIFICATE OF AUTHENTICITY
            </p>

            {cfg.template === "gallery" && cfg.showImage && cfg.imageUrl && (
              <img src={cfg.imageUrl} alt={cfg.title} className="cert-img-large" />
            )}

            <h2
              className="cert-title"
              style={{ fontSize: template.titleSize, fontFamily: template.id === "ledger" ? MONO : SERIF }}
            >
              {cfg.title || "Untitled"}
            </h2>
            <p className="cert-artist" style={{ color: template.muted }}>
              {cfg.artist}
            </p>

            {cfg.template !== "gallery" && cfg.showImage && cfg.imageUrl && (
              <img src={cfg.imageUrl} alt={cfg.title} className="cert-img" />
            )}

            <dl
              className={`cert-details ${template.details === "grid" ? "cert-details-grid" : ""} ${template.ornament === "ruled" ? "cert-details-ruled" : ""}`}
              style={template.id === "minimal" ? { borderTop: `1px solid ${accent}` } : undefined}
            >
              <div>
                <dt style={{ color: template.muted }}>Medium</dt>
                <dd style={{ fontFamily: template.id === "ledger" ? MONO : undefined }}>{cfg.medium || "N/A"}</dd>
              </div>
              <div>
                <dt style={{ color: template.muted }}>Dimensions</dt>
                <dd style={{ fontFamily: template.id === "ledger" ? MONO : undefined }}>{cfg.dimensions || "N/A"}</dd>
              </div>
              <div>
                <dt style={{ color: template.muted }}>Year</dt>
                <dd style={{ fontFamily: template.id === "ledger" ? MONO : undefined }}>{cfg.year || "N/A"}</dd>
              </div>
              <div>
                <dt style={{ color: template.muted }}>Edition</dt>
                <dd style={{ fontFamily: template.id === "ledger" ? MONO : undefined }}>{editionLabel(cfg)}</dd>
              </div>
              {priceNumber !== null && (
                <div>
                  <dt style={{ color: template.muted }}>Price</dt>
                  <dd>
                    {formatCurrency(priceNumber, "USD")}
                    {rates.status === "ready" && (
                      <>
                        {" "}
                        ·{" "}
                        {(["EUR", "GBP", "CHF", "UGX"] as const)
                          .map((code) => {
                            const value = convert(priceNumber, "USD", code, rates.rates);
                            return value === null ? null : formatCurrency(value, code);
                          })
                          .filter((text): text is string => text !== null)
                          .join(" · ")}
                        <span style={{ color: template.muted, fontWeight: 400 }}>
                          {" "}
                          (ECB reference rates of {formatRateDate(rates.date)}
                          {rates.stale ? ", last rates available" : ""})
                        </span>
                      </>
                    )}
                    {rates.status === "unavailable" && (
                      <span style={{ color: template.muted, fontWeight: 400 }}> (exchange rates unavailable)</span>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt style={{ color: template.muted }}>Certificate ID</dt>
                <dd style={{ fontFamily: template.id === "ledger" ? MONO : undefined }}>{cfg.certificateId}</dd>
              </div>
            </dl>

            <p className="cert-statement">
              This document certifies that the work described above is an original work by {cfg.artist}, issued in {cfg.place} on{" "}
              {formatIssueDate(cfg.issueDate)}.
            </p>

            <div className="cert-foot">
              <div className="cert-sign">
                <div className="cert-sign-col">
                  {cfg.signatureText ? (
                    <span className="cert-sig-script">{cfg.signatureText}</span>
                  ) : (
                    <span className="cert-sig-blank" />
                  )}
                  <span className="cert-sig-line" style={{ background: template.ink }} />
                  <p style={{ color: template.muted }}>{cfg.signatureName}, Artist</p>
                </div>
                <div className="cert-sign-col">
                  <span className="cert-sig-blank" />
                  <span className="cert-sig-line" style={{ background: template.ink }} />
                  <p style={{ color: template.muted }}>
                    {cfg.place}, {formatIssueDate(cfg.issueDate)}
                  </p>
                </div>
                {template.ornament === "ruled" && (
                  <div className="cert-stamp" style={{ borderColor: template.ink, color: template.ink }}>
                    ORIGINAL
                  </div>
                )}
              </div>

              <div className="cert-verify-row">
                {template.id === "heritage" && (
                  <div className="cert-seal" style={{ background: accent }}>
                    {watermarkInitial}
                  </div>
                )}
                <p style={{ color: template.muted }}>
                  {cfg.verificationNote}
                  <br />
                  <strong style={{ color: template.ink }}>Certificate ID: {cfg.certificateId}</strong>
                </p>
                <div className="cert-qr">
                  {qrError ? (
                    <p className="cert-qr-fallback">QR unavailable, verify with the certificate ID above.</p>
                  ) : (
                    <>
                      <canvas ref={qrRef} width={132} height={132} aria-label={`QR code for certificate ${cfg.certificateId}`} />
                      <p style={{ color: template.muted }}>Scan to verify</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* -- How verification works (online, by ID or QR code) -------------- */}
        <div className="cert-verify-box">
          <h3>How anyone verifies this certificate</h3>
          <p>
            Every certificate is checked online, automatically: scan the QR code on the certificate, or enter the certificate ID printed on
            it at the Lakisa verification page (/verify). The service confirms whether the certificate is registered and shows the work it
            belongs to: title, artist, medium, dimensions, year and edition must match the artwork itself. An ID that is not registered
            is reported as not found. When in doubt, the holder should contact the artist directly and quote the certificate ID.
          </p>
          <p>
            Export is a real one-page PDF (“Download PDF”, rendered server-side in the template and paper size shown above) or through your
            browser (“Print” opens the print dialog, where you choose “Save as PDF”).
          </p>
        </div>
      </div>

      {/* -- Issued certificates -------------------------------------------- */}
      <section className="cert-issued">
        <h3>Issued certificates</h3>
        <p className="cert-issued-sub">
          Every certificate you issue is saved in your account and in the database. Open one to edit or reprint it; revoking removes it from
          this list and from its file archive.
        </p>
        {savedLoading && <p className="cert-hint">Loading your issued certificates…</p>}
        {savedError && (
          <p role="alert" className="cert-msg cert-msg-error">
            {savedError}
          </p>
        )}
        {!savedLoading && !savedError && saved.length === 0 && (
          <div className={styles.emptyBox}>
            <strong>No certificates issued yet.</strong>
            <p>Fill in the details above and choose “Issue certificate”, it will appear here, ready to reprint.</p>
          </div>
        )}
        {saved.length > 0 && (
          <ul className="cert-issued-list">
            {saved.map((row) => {
              const data = row.data as Partial<CertificateConfig>;
              const certId = typeof data.certificateId === "string" ? data.certificateId : "";
              const issued = new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
              const confirming = confirmDeleteId === row.id;
              const archived = archivedIds?.has(row.id) ?? false;
              return (
                <li key={row.id} className={`cert-issued-row ${loadedId === row.id ? "active" : ""}`}>
                  <div className="cert-issued-info">
                    <strong>{row.title}</strong>
                    <span>
                      Issued {issued}
                      {certId ? ` · ${certId}` : ""}
                      {archived ? " · Archived in your account" : ""}
                    </span>
                  </div>
                  <div className="cert-issued-actions">
                    <button type="button" className="cert-button" onClick={() => loadSaved(row)}>
                      View
                    </button>
                    <button type="button" className="cert-button" onClick={() => reprintSaved(row)}>
                      Reprint
                    </button>
                    {confirming ? (
                      <>
                        <button
                          type="button"
                          className="cert-button cert-button-danger"
                          disabled={deletingId === row.id}
                          onClick={() => revokeSaved(row)}
                        >
                          {deletingId === row.id ? "Revoking…" : "Confirm revoke"}
                        </button>
                        <button type="button" className="cert-button" onClick={() => setConfirmDeleteId(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button type="button" className="cert-button" onClick={() => setConfirmDeleteId(row.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

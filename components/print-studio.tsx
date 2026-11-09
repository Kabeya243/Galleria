"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { archiveToolDocument, deleteToolArchive } from "@/lib/tool-archive";
import styles from "@/components/tools.module.css";

// Print Production Studio — production-ready materials from the artist's own
// artworks: posters, wall labels, catalogue pages and certificates. Real
// print dimensions (A-series + custom cm), bleed and safe margins, a real
// DPI check computed from the image's actual pixel size against the print
// size, and a production PDF via a print stylesheet with bleed marks drawn
// in CSS.
//
// Honest limits, stated on the page: there is no true CMYK conversion in
// the browser — everything here is sRGB, and printer-specific requirements
// (ICC profiles, paper, finishing) vary, so the studio says so instead of
// pretending otherwise.
//
// Design: the existing white-gallery luxury language only. Component styles
// live in the <style> block at the bottom of this file.

export type PrintArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionTitle: string;
};

type LayoutId = "poster" | "wall-label" | "catalogue" | "certificate";

const LAYOUTS: { id: LayoutId; label: string; blurb: string }[] = [
  { id: "poster", label: "Poster", blurb: "Full-bleed artwork with title and caption." },
  { id: "wall-label", label: "Wall label", blurb: "Small didactic label for the gallery wall." },
  { id: "catalogue", label: "Catalogue page", blurb: "Artwork with a longer text block, one page." },
  { id: "certificate", label: "Certificate", blurb: "Certificate of authenticity for a sold work." },
];

const PAPER_SIZES: { id: string; label: string; wCm: number; hCm: number }[] = [
  { id: "A0", label: "A0: 84.1 × 118.9 cm", wCm: 84.1, hCm: 118.9 },
  { id: "A1", label: "A1: 59.4 × 84.1 cm", wCm: 59.4, hCm: 84.1 },
  { id: "A2", label: "A2: 42.0 × 59.4 cm", wCm: 42, hCm: 59.4 },
  { id: "A3", label: "A3: 29.7 × 42.0 cm", wCm: 29.7, hCm: 42 },
  { id: "A4", label: "A4: 21.0 × 29.7 cm", wCm: 21, hCm: 29.7 },
  { id: "A5", label: "A5: 14.8 × 21.0 cm", wCm: 14.8, hCm: 21 },
  { id: "custom", label: "Custom size…", wCm: 30, hCm: 40 },
];

type PrintJob = {
  layout: LayoutId;
  artworkId: string;
  paperId: string;
  widthCm: number;
  heightCm: number;
  bleedMm: number;
  safeMm: number;
  title: string;
  artistName: string;
  caption: string;
  bodyText: string;
  edition: string;
  showCropMarks: boolean;
};

type SavedJob = { id: string; title: string; data: Record<string, unknown>; updatedAt: string };

function loadImageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = url;
  });
}

function defaultJob(artistName: string, artworks: PrintArtwork[]): PrintJob {
  const first = artworks[0];
  return {
    layout: "poster",
    artworkId: first?.id ?? "",
    paperId: "A3",
    widthCm: 29.7,
    heightCm: 42,
    bleedMm: 3,
    safeMm: 10,
    title: first?.title ?? "",
    artistName,
    caption: first ? [first.year, first.medium, first.dimensions].filter(Boolean).join(" · ") : "",
    bodyText: first?.description ?? "",
    edition: "",
    showCropMarks: true,
  };
}

function jobFromSaved(data: Record<string, unknown>, artistName: string, artworks: PrintArtwork[]): PrintJob {
  const base = defaultJob(artistName, artworks);
  const merged = { ...base, ...(data as Partial<PrintJob>) };
  if (typeof merged.widthCm !== "number" || merged.widthCm <= 0) merged.widthCm = base.widthCm;
  if (typeof merged.heightCm !== "number" || merged.heightCm <= 0) merged.heightCm = base.heightCm;
  return merged;
}

export default function PrintStudio({
  userName,
  artworks,
}: {
  userName: string;
  artworks: PrintArtwork[];
}) {
  const [job, setJob] = useState<PrintJob>(() => defaultJob(userName, artworks));
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [imgState, setImgState] = useState<"none" | "loading" | "ok" | "error">("none");
  const [saved, setSaved] = useState<SavedJob[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;
  // Sheet fit: the live preview is scaled down (never up) so the whole
  // studio fits the viewport without scrolling — see the effect below.
  const sheetWrapRef = useRef<HTMLDivElement | null>(null);
  const [sheetScale, setSheetScale] = useState(1);

  const selectedArt = useMemo(() => artworks.find((a) => a.id === job.artworkId), [artworks, job.artworkId]);

  // Real pixel size of the chosen artwork image — the DPI check depends on it.
  useEffect(() => {
    let cancelled = false;
    if (!selectedArt?.imageUrl) {
      setImgSize(null);
      setImgState("none");
      return;
    }
    setImgState("loading");
    loadImageSize(selectedArt.imageUrl)
      .then((size) => {
        if (!cancelled) {
          setImgSize(size);
          setImgState("ok");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImgSize(null);
          setImgState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedArt]);

  const dpi = useMemo(() => {
    if (!imgSize) return null;
    const wIn = job.widthCm / 2.54;
    const hIn = job.heightCm / 2.54;
    return { w: Math.round(imgSize.w / wIn), h: Math.round(imgSize.h / hIn) };
  }, [imgSize, job.widthCm, job.heightCm]);

  const dpiVerdict = useMemo(() => {
    if (!dpi) return null;
    const min = Math.min(dpi.w, dpi.h);
    if (min >= 300) return { tone: "good", text: `Excellent, ${dpi.w} × ${dpi.h} dpi. Crisp at this size.` };
    if (min >= 200) return { tone: "good", text: `Good, ${dpi.w} × ${dpi.h} dpi. Fine for print at this size.` };
    if (min >= 150) return { tone: "warn", text: `Acceptable, ${dpi.w} × ${dpi.h} dpi. Fine for a poster viewed at a distance, but not for close inspection.` };
    if (min >= 100) return { tone: "warn", text: `Low, ${dpi.w} × ${dpi.h} dpi. The print will look soft up close. Use a smaller print size or a higher-resolution file.` };
    return { tone: "bad", text: `Too low, ${dpi.w} × ${dpi.h} dpi. This will print visibly pixelated at ${job.widthCm} × ${job.heightCm} cm. Print smaller or re-scan the work.` };
  }, [dpi, job.widthCm, job.heightCm]);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=print-job");
      if (!res.ok) throw new Error("Could not load your saved print jobs.");
      const json = (await res.json()) as { saved: SavedJob[] };
      setSaved(json.saved ?? []);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : "Could not load your saved print jobs.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const update = useCallback((patch: Partial<PrintJob>) => {
    setJob((j) => ({ ...j, ...patch }));
  }, []);

  const pickPaper = useCallback((id: string) => {
    const paper = PAPER_SIZES.find((p) => p.id === id);
    if (!paper) return;
    setJob((j) => ({ ...j, paperId: id, widthCm: paper.wCm, heightCm: paper.hCm }));
  }, []);

  const pickArtwork = useCallback(
    (id: string) => {
      const art = artworks.find((a) => a.id === id);
      if (!art) return;
      setJob((j) => ({
        ...j,
        artworkId: id,
        title: art.title,
        caption: [art.year, art.medium, art.dimensions].filter(Boolean).join(" · "),
        bodyText: art.description || j.bodyText,
      }));
    },
    [artworks],
  );

  const doSave = useCallback(async () => {
    const title = saveTitle.trim() || jobRef.current.title.trim() || "Untitled print job";
    setSaving(true);
    setSaveMsg(null);
    try {
      let savedId: string | null = loadedId;
      if (loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title, data: jobRef.current }),
        });
        if (!res.ok) throw new Error("Could not update this print job.");
        setSaveMsg(`Updated “${title}”.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "print-job", title, data: jobRef.current }),
        });
        if (!res.ok) throw new Error("Could not save this print job.");
        const json = (await res.json()) as { saved: SavedJob };
        savedId = json.saved.id;
        setLoadedId(json.saved.id);
        setSaveMsg(`Saved “${title}”.`);
      }
      // R2 archive copy, same mechanism as Atelier designs (best-effort).
      if (savedId) {
        const archived = await archiveToolDocument("print-job", savedId, jobRef.current);
        if (archived.archived) setSaveMsg((prev) => `${prev ?? ""} Archived in your account.`);
      }
      setSaveTitle("");
      await refreshSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save this print job.");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, loadedId, refreshSaved]);

  const doLoad = useCallback(
    (row: SavedJob) => {
      setJob(jobFromSaved(row.data, userName, artworks));
      setLoadedId(row.id);
      setSaveTitle(row.title);
      setSaveMsg(`Loaded “${row.title}”.`);
    },
    [userName, artworks],
  );

  const doDelete = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Could not delete this print job.");
        await deleteToolArchive("print-job", id);
        if (loadedId === id) setLoadedId(null);
        setConfirmDeleteId(null);
        await refreshSaved();
        setSaveMsg(`Deleted “${title}”.`);
      } catch {
        setSaveMsg("Could not delete this print job.");
      }
    },
    [loadedId, refreshSaved],
  );

  const newJob = useCallback(() => {
    setJob(defaultJob(userName, artworks));
    setLoadedId(null);
    setSaveTitle("");
    setSaveMsg("Started a new print job.");
  }, [userName, artworks]);

  const printPdf = useCallback(() => {
    setPrintMsg("Printing… choose “Save as PDF” in the print dialog. The PDF keeps the bleed and crop marks.");
    window.print();
  }, []);

  const bleedCm = job.bleedMm / 10;
  const totalW = job.widthCm + bleedCm * 2;
  const totalH = job.heightCm + bleedCm * 2;
  // Preview scale: fit the sheet into ~560px wide.
  const previewScale = Math.min(1, 560 / (totalW * 10));
  const sheetWpx = Math.round(totalW * 10 * previewScale);
  const sheetHpx = Math.round(totalH * 10 * previewScale);

  // Fit the sheet inside the preview column on desktop: measure the
  // space the sheet wrap gives it and scale the sheet down (never up)
  // so it fits without the preview scrolling. The sheet's layout size
  // is fixed by its print dimensions, so a transform scale is enough —
  // the wrapper is given the scaled size so no empty space is left
  // behind. Below 1080 px the columns stack and the sheet keeps its
  // natural size (scale 1).
  useEffect(() => {
    const wrap = sheetWrapRef.current;
    if (!wrap) return;
    const measure = () => {
      if (!window.matchMedia("(min-width: 1081px)").matches) {
        setSheetScale(1);
        return;
      }
      const availW = wrap.clientWidth - 40; // wrap padding
      const availH = wrap.clientHeight - 40;
      if (!availW || !availH || !sheetWpx || !sheetHpx) return;
      setSheetScale(Math.min(1, availW / sheetWpx, availH / sheetHpx));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [sheetWpx, sheetHpx]);

  return (
    <div className="pr">
      <div className="pr-editor">
        <section className="pr-card">
          <h2>Artwork &amp; layout</h2>
          <label className={styles.field}>
            Artwork
            <select value={job.artworkId} onChange={(e) => pickArtwork(e.target.value)}>
              {artworks.map((a) => (
                <option key={a.id} value={a.id}>{a.title}, {a.exhibitionTitle}</option>
              ))}
            </select>
          </label>
          <div className="pr-kinds">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" className={`pr-kind ${job.layout === l.id ? "active" : ""}`} onClick={() => update({ layout: l.id })} aria-pressed={job.layout === l.id}>
                <strong>{l.label}</strong>
                <span>{l.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pr-card">
          <h2>Print size</h2>
          <label className={styles.field}>
            Paper size
            <select value={job.paperId} onChange={(e) => pickPaper(e.target.value)}>
              {PAPER_SIZES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <div className="pr-row">
            <label className={styles.field}>
              Width (cm)
              <input type="number" min={1} step={0.1} value={job.widthCm} onChange={(e) => update({ widthCm: Number(e.target.value) || 0, paperId: "custom" })} />
            </label>
            <label className={styles.field}>
              Height (cm)
              <input type="number" min={1} step={0.1} value={job.heightCm} onChange={(e) => update({ heightCm: Number(e.target.value) || 0, paperId: "custom" })} />
            </label>
          </div>
          <div className="pr-row">
            <label className={styles.field}>
              Bleed (mm)
              <input type="number" min={0} max={10} step={0.5} value={job.bleedMm} onChange={(e) => update({ bleedMm: Number(e.target.value) || 0 })} />
            </label>
            <label className={styles.field}>
              Safe margin (mm)
              <input type="number" min={0} max={50} step={1} value={job.safeMm} onChange={(e) => update({ safeMm: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <label className="pr-check">
            <input type="checkbox" checked={job.showCropMarks} onChange={(e) => update({ showCropMarks: e.target.checked })} />
            Show crop marks on the PDF
          </label>
          <p className="pr-note">Trim size {job.widthCm} × {job.heightCm} cm · with bleed {totalW.toFixed(1)} × {totalH.toFixed(1)} cm.</p>
        </section>

        <section className="pr-card">
          <h2>Resolution check</h2>
          {imgState === "none" && <p className="pr-note">This artwork has no uploaded image, so no DPI can be computed. The preview uses a colour stand-in.</p>}
          {imgState === "loading" && <p className="pr-note">Reading the image's pixel size…</p>}
          {imgState === "error" && <p className="pr-error">Could not read this image's pixel size. The DPI check is unavailable. Check the file in the editor.</p>}
          {imgState === "ok" && imgSize && (
            <>
              <p className="pr-note">Image file: {imgSize.w} × {imgSize.h} px. At {job.widthCm} × {job.heightCm} cm that is {dpi?.w} × {dpi?.h} dpi.</p>
              {dpiVerdict && <p className={`pr-verdict ${dpiVerdict.tone}`}>{dpiVerdict.text}</p>}
              <p className="pr-note">Rule of thumb: 300 dpi for close viewing, 150 dpi is fine for a poster seen from a distance. Below 100 dpi the print will look pixelated.</p>
            </>
          )}
        </section>

        <section className="pr-card">
          <h2>Colour profile</h2>
          <p className="pr-note">
            Everything in this studio is <strong>sRGB</strong>, the colour space of screens and of the image files Lakisa stores.
            There is <strong>no true CMYK conversion in the browser</strong>: the PDF you print from here is still sRGB, and a print shop
            converts it with its own profile. If your printer asks for CMYK, convert the file in Photoshop, Affinity or with the
            printer's own ICC profile. This tool does not pretend to do it. Printer requirements (paper, ICC profile, finishing)
            vary, so always confirm the spec sheet with your printer before a run.
          </p>
        </section>

        <section className="pr-card">
          <h2>Text</h2>
          <label className={styles.field}>
            Title
            <input value={job.title} onChange={(e) => update({ title: e.target.value })} />
          </label>
          <label className={styles.field}>
            Artist name
            <input value={job.artistName} onChange={(e) => update({ artistName: e.target.value })} />
          </label>
          <label className={styles.field}>
            Caption (year · medium · dimensions)
            <input value={job.caption} onChange={(e) => update({ caption: e.target.value })} />
          </label>
          {(job.layout === "catalogue" || job.layout === "wall-label") && (
            <label className={styles.field}>
              Text
              <textarea value={job.bodyText} rows={5} onChange={(e) => update({ bodyText: e.target.value })} />
            </label>
          )}
          {job.layout === "certificate" && (
            <label className={styles.field}>
              Edition (e.g. “Edition 1 of 5”)
              <input value={job.edition} onChange={(e) => update({ edition: e.target.value })} placeholder="Edition 1 of 1" />
            </label>
          )}
        </section>

        <section className="pr-card">
          <h2>Production PDF &amp; save</h2>
          <div className="pr-actions">
            <button type="button" className="pr-btn primary" onClick={printPdf}>Print / save production PDF</button>
          </div>
          {printMsg && <p className="pr-msg" role="status">{printMsg}</p>}
          <label className={styles.field}>
            Job name (for your saved list)
            <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder={job.title || "Untitled print job"} />
          </label>
          <div className="pr-actions">
            <button type="button" className="pr-btn primary" onClick={() => void doSave()} disabled={saving}>
              {saving ? "Saving…" : loadedId ? "Update job" : "Save job"}
            </button>
            <button type="button" className="pr-btn secondary" onClick={newJob}>New job</button>
          </div>
          {saveMsg && <p className="pr-msg" role="status">{saveMsg}</p>}
        </section>

        <section className="pr-card">
          <h2>Your saved print jobs</h2>
          {savedLoading ? (
            <p className="pr-note">Loading your saved print jobs…</p>
          ) : savedError ? (
            <p className="pr-error">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="pr-note">No saved print jobs yet.</p>
          ) : (
            <ul className="pr-saved">
              {saved.map((row) => (
                <li key={row.id}>
                  <button type="button" className="pr-saved-title" onClick={() => doLoad(row)}>{row.title}</button>
                  <span className="pr-muted">{new Date(row.updatedAt).toLocaleDateString()}</span>
                  {confirmDeleteId === row.id ? (
                    <>
                      <button type="button" className="pr-danger" onClick={() => void doDelete(row.id, row.title)}>Confirm delete</button>
                      <button type="button" className="pr-btn secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="pr-danger" onClick={() => setConfirmDeleteId(row.id)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Preview / print sheet ---- */}
      <div className="pr-preview-col">
        <div className="pr-preview-bar">
          <strong>Print preview</strong>
          <span className="pr-muted">{totalW.toFixed(1)} × {totalH.toFixed(1)} cm incl. bleed · preview scaled</span>
        </div>
        <div className="pr-sheet-wrap" ref={sheetWrapRef}>
          <div style={{ width: Math.max(1, Math.round(sheetWpx * sheetScale)), height: Math.max(1, Math.round(sheetHpx * sheetScale)) }}>
          <div
            className="pr-sheet print-area"
            style={{ width: sheetWpx, height: sheetHpx, ["--bleed-px" as string]: `${bleedCm * 10 * previewScale}px`, ["--safe-px" as string]: `${job.safeMm * previewScale}px`, transform: sheetScale === 1 ? undefined : `scale(${sheetScale})`, transformOrigin: "top left" }}
            data-print-w={`${totalW}cm`}
            data-print-h={`${totalH}cm`}
          >
            {job.showCropMarks && (
              <>
                <i className="pr-mark tl" /><i className="pr-mark tr" /><i className="pr-mark bl" /><i className="pr-mark br" />
              </>
            )}
            <div className="pr-bleed" style={{ inset: "var(--bleed-px)" }}>
              {job.layout === "poster" && (
                <div className="pr-poster">
                  <div className="pr-art">
                    {selectedArt?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedArt.imageUrl} alt={selectedArt.title} />
                    ) : (
                      <div className="pr-art-ph" style={{ background: `linear-gradient(135deg, ${selectedArt?.color ?? "#b8a184"}, ${selectedArt?.accent ?? "#343e36"})` }}>
                        {selectedArt?.title}
                      </div>
                    )}
                  </div>
                  <div className="pr-poster-text">
                    <h3>{job.title}</h3>
                    <p>{job.artistName}</p>
                    {job.caption && <p className="pr-dim">{job.caption}</p>}
                  </div>
                </div>
              )}
              {job.layout === "wall-label" && (
                <div className="pr-label">
                  <h3>{job.artistName}</h3>
                  <h4>{job.title}</h4>
                  {job.caption && <p>{job.caption}</p>}
                  {job.bodyText && <p className="pr-body">{job.bodyText}</p>}
                </div>
              )}
              {job.layout === "catalogue" && (
                <div className="pr-catalogue">
                  <div className="pr-art">
                    {selectedArt?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedArt.imageUrl} alt={selectedArt.title} />
                    ) : (
                      <div className="pr-art-ph" style={{ background: `linear-gradient(135deg, ${selectedArt?.color ?? "#b8a184"}, ${selectedArt?.accent ?? "#343e36"})` }}>
                        {selectedArt?.title}
                      </div>
                    )}
                  </div>
                  <h3>{job.title}</h3>
                  <p className="pr-dim">{job.artistName}{job.caption ? `, ${job.caption}` : ""}</p>
                  {job.bodyText && <p className="pr-body">{job.bodyText}</p>}
                </div>
              )}
              {job.layout === "certificate" && (
                <div className="pr-cert">
                  <p className="pr-cert-eyebrow">Certificate of Authenticity</p>
                  <h3>{job.title}</h3>
                  <p>by {job.artistName}</p>
                  {job.caption && <p className="pr-dim">{job.caption}</p>}
                  {job.edition && <p>{job.edition}</p>}
                  <div className="pr-cert-sign">
                    <span>Artist signature</span>
                    <span>Date</span>
                  </div>
                  <p className="pr-cert-foot">This certificate confirms the authenticity of the work described above. sRGB file, no CMYK conversion applied in-browser.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
        <p className="pr-note pr-limit">
          Limits: no true CMYK conversion in-browser; the PDF is sRGB. Printer-specific requirements (ICC profile, paper, finishing) vary, so confirm with your printer.
        </p>
      </div>

      <style>{`
        .pr { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 28px; align-items: start; }
        @media (max-width: 1080px) { .pr { grid-template-columns: 1fr; } }
        /* Desktop: the studio fills the viewport (same 100dvh frame as
           the certificate tool): the preview column never scrolls (the
           sheet is scaled down to fit it, see the ResizeObserver
           above), and only the editor scrolls, with a hidden
           scrollbar. Below 1080 px the columns stack and everything
           flows naturally again. */
        @media (min-width: 1081px) {
          .pr { height: calc(100dvh - 280px); min-height: 560px; align-items: stretch; }
          .pr-editor { min-height: 0; overflow-y: auto; scrollbar-width: none; }
          .pr-editor::-webkit-scrollbar { display: none; }
          .pr-preview-col { min-height: 0; overflow: hidden; display: flex; flex-direction: column; position: static; }
          .pr-sheet-wrap { flex: 1; min-height: 0; overflow: hidden; }
        }
        .pr-editor { display: flex; flex-direction: column; gap: 18px; }
        .pr-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .pr-card h2 { margin: 0; font-size: 17px; font-family: Fraunces, Georgia, serif; }
        .pr-card textarea { padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 14px; resize: vertical; }
        .pr-note { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
        .pr-muted { color: var(--muted); font-size: 12px; }
        .pr-error { margin: 0; font-size: 13px; color: #9a2b2b; }
        .pr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .pr-row { grid-template-columns: 1fr; } }
        .pr-kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 560px) { .pr-kinds { grid-template-columns: 1fr; } }
        .pr-kind { text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 10px 12px; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 2px; }
        .pr-kind strong { font-size: 14px; }
        .pr-kind span { font-size: 12px; color: var(--muted); line-height: 1.45; }
        .pr-kind.active { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
        .pr-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
        .pr-check input { accent-color: #ffffff; width: 16px; height: 16px; }
        .pr-verdict { margin: 0; font-size: 13px; line-height: 1.55; padding: 10px 12px; border-radius: 6px; }
        .pr-verdict.good { background: #eef4ea; color: #2f5d2a; }
        .pr-verdict.warn { background: #fdf3e0; color: #7a5410; }
        .pr-verdict.bad { background: #fbe9e9; color: #9a2b2b; }
        .pr-btn { border-radius: 6px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid var(--ink); }
        .pr-btn.primary { background: var(--ink); color: var(--paper); }
        .pr-btn.secondary { background: transparent; color: var(--ink); }
        .pr-btn:disabled { opacity: 0.55; cursor: wait; }
        .pr-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .pr-msg { margin: 0; font-size: 13px; color: var(--muted); }
        .pr-saved { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pr-saved li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
        .pr-saved-title { background: none; border: none; padding: 0; cursor: pointer; font: inherit; font-weight: 600; color: var(--ink); text-align: left; }
        .pr-danger { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: #9a2b2b; }
        .pr-preview-col { position: sticky; top: 16px; }
        @media (max-width: 1080px) { .pr-preview-col { position: static; } }
        .pr-preview-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .pr-preview-bar strong { font-family: Fraunces, Georgia, serif; font-size: 17px; }
        .pr-sheet-wrap { background: #ece9e3; border: 1px solid var(--line); border-radius: 10px; padding: 20px; display: grid; place-items: center; overflow: auto; }
        .pr-sheet { position: relative; background: #fdfdfc; color: #141414; box-shadow: 0 2px 18px rgba(0,0,0,0.18); flex: none; }
        .pr-bleed { position: absolute; border: 1px dashed #c9a35c; overflow: hidden; }
        .pr-mark { position: absolute; width: 18px; height: 18px; }
        .pr-mark.tl { top: 2px; left: 2px; border-top: 1px solid #141414; border-left: 1px solid #141414; }
        .pr-mark.tr { top: 2px; right: 2px; border-top: 1px solid #141414; border-right: 1px solid #141414; }
        .pr-mark.bl { bottom: 2px; left: 2px; border-bottom: 1px solid #141414; border-left: 1px solid #141414; }
        .pr-mark.br { bottom: 2px; right: 2px; border-bottom: 1px solid #141414; border-right: 1px solid #141414; }
        .pr-art { width: 100%; }
        .pr-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pr-art-ph { width: 100%; height: 100%; display: grid; place-items: center; color: #fff; font-family: Fraunces, Georgia, serif; font-size: 15px; padding: 12px; text-align: center; }
        .pr-poster { display: flex; flex-direction: column; height: 100%; padding: var(--safe-px); box-sizing: border-box; }
        .pr-poster .pr-art { flex: 1; min-height: 0; overflow: hidden; }
        .pr-poster-text { padding-top: 10px; text-align: center; }
        .pr-poster-text h3, .pr-catalogue h3, .pr-cert h3 { font-family: Fraunces, Georgia, serif; margin: 0 0 4px; font-size: 18px; }
        .pr-poster-text p, .pr-catalogue p { margin: 0; font-size: 12px; line-height: 1.5; }
        .pr-dim { color: #6f6a61; }
        .pr-label { padding: calc(var(--safe-px) + 8px); box-sizing: border-box; height: 100%; }
        .pr-label h3 { font-family: Fraunces, Georgia, serif; margin: 0; font-size: 17px; }
        .pr-label h4 { font-family: Fraunces, Georgia, serif; margin: 4px 0; font-size: 15px; font-style: italic; }
        .pr-label p { margin: 4px 0; font-size: 12px; line-height: 1.55; }
        .pr-catalogue { padding: var(--safe-px); box-sizing: border-box; height: 100%; overflow: hidden; }
        .pr-catalogue .pr-art { height: 55%; overflow: hidden; margin-bottom: 12px; }
        .pr-body { font-size: 12px; line-height: 1.6; margin-top: 8px !important; }
        .pr-cert { padding: calc(var(--safe-px) + 14px); box-sizing: border-box; height: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .pr-cert-eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #000000; margin: 0 0 12px; }
        .pr-cert p { font-size: 12px; margin: 3px 0; }
        .pr-cert-sign { display: flex; justify-content: space-between; width: 80%; margin-top: 28px; border-top: 1px solid #141414; padding-top: 6px; font-size: 11px; color: #6f6a61; }
        .pr-cert-foot { color: #6f6a61; font-size: 10px !important; margin-top: 18px !important; }
        .pr-limit { margin-top: 12px; }
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; box-shadow: none !important; transform: none !important; }
          .print-area .pr-bleed { border: none !important; }
        }
      `}</style>
      {/* @page size must be a literal — CSS vars are not honoured in @page. */}
      <style>{`@media print { @page { size: ${totalW.toFixed(1)}cm ${totalH.toFixed(1)}cm; margin: 0; } }`}</style>
    </div>
  );
}

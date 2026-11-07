// Portfolio PDF builder — pick one of 50 original templates, edit the
// cover/bio/contact, select works, preview the exact printable portfolio
// and export it as PDF via the browser print dialog ("Save as PDF").
// No PDF library is in the stack and none was added: export is
// window.print() + the print stylesheet in components/portfolio-print.tsx.
// The portfolio is saved to SavedWork kind "portfolio-pdf" so it can be
// reopened and edited later. All errors are shown inline, never
// window.alert.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PortfolioPrint, { type PortfolioConfig, type PortfolioWork } from "@/components/portfolio-print";
import { PDF_TEMPLATES, PDF_TEMPLATE_COUNT, PDF_TEMPLATE_FAMILIES, pdfTemplateById, type PdfTemplate } from "@/lib/pdf-templates";
import styles from "@/components/tools.module.css";

export type PdfBuilderArtwork = PortfolioWork & { exhibitionTitle: string };

type SavedPortfolio = { id: string; title: string; data: PortfolioConfig & { templateId: string; workIds: string[] } };

function portfolioFromSaved(saved: SavedPortfolio): { config: PortfolioConfig; templateId: string; workIds: string[] } {
  return {
    config: {
      title: typeof saved.data.title === "string" ? saved.data.title : "",
      artistName: typeof saved.data.artistName === "string" ? saved.data.artistName : "",
      bio: typeof saved.data.bio === "string" ? saved.data.bio : "",
      contact: typeof saved.data.contact === "string" ? saved.data.contact : "",
    },
    templateId: typeof saved.data.templateId === "string" ? saved.data.templateId : PDF_TEMPLATES[0].id,
    workIds: Array.isArray(saved.data.workIds) ? saved.data.workIds.filter((x): x is string => typeof x === "string") : [],
  };
}

export default function PortfolioPdfBuilder({
  userName,
  userEmail,
  userBio,
  artworks,
}: {
  userName: string;
  userEmail: string;
  userBio: string | null;
  artworks: PdfBuilderArtwork[];
}) {
  const [templateId, setTemplateId] = useState(PDF_TEMPLATES[0].id);
  const [config, setConfig] = useState<PortfolioConfig>({ title: "", artistName: userName, bio: userBio ?? "", contact: userEmail });
  const [workIds, setWorkIds] = useState<string[]>(artworks.map((a) => a.id));
  const [templateFamily, setTemplateFamily] = useState<string>("all");
  const [templateQuery, setTemplateQuery] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPortfolio[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;
  const templateIdRef = useRef(templateId);
  templateIdRef.current = templateId;
  const workIdsRef = useRef(workIds);
  workIdsRef.current = workIds;

  const template: PdfTemplate = useMemo(() => pdfTemplateById(templateId), [templateId]);
  const selectedWorks = useMemo(
    () => workIds.map((id) => artworks.find((a) => a.id === id)).filter((a): a is PdfBuilderArtwork => Boolean(a)),
    [workIds, artworks],
  );
  const shownTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    return PDF_TEMPLATES.filter(
      (t) =>
        (templateFamily === "all" || t.family === templateFamily) &&
        (q === "" || `${t.label} ${t.blurb} ${t.family}`.toLowerCase().includes(q)),
    );
  }, [templateFamily, templateQuery]);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=portfolio-pdf");
      if (!res.ok) throw new Error("Could not load your saved portfolios.");
      const json = (await res.json()) as { saved: SavedPortfolio[] };
      setSaved(json.saved ?? []);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : "Could not load your saved portfolios.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const loadSaved = useCallback((s: SavedPortfolio) => {
    const parsed = portfolioFromSaved(s);
    setConfig({ ...parsed.config, artistName: parsed.config.artistName || userName });
    setTemplateId(parsed.templateId);
    setWorkIds(parsed.workIds.length > 0 ? parsed.workIds : artworks.map((a) => a.id));
    setLoadedId(s.id);
    setSaveMsg(`Loaded “${s.title}”.`);
    setError(null);
  }, [artworks, userName]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const title = configRef.current.title.trim() || `${configRef.current.artistName || userName} — Portfolio`;
      const data = { ...configRef.current, templateId: templateIdRef.current, workIds: workIdsRef.current };
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loadedId ? { id: loadedId, title, data } : { kind: "portfolio-pdf", title, data }),
      });
      if (!res.ok) throw new Error("Could not save this portfolio.");
      const json = (await res.json()) as { saved: SavedPortfolio };
      setLoadedId(json.saved.id);
      setSaveMsg(`Saved “${title}”. Reopen it anytime from your saved portfolios below.`);
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this portfolio.");
    } finally {
      setSaving(false);
    }
  }, [loadedId, refreshSaved, userName]);

  const removeSaved = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this portfolio.");
      if (loadedId === id) setLoadedId(null);
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this portfolio.");
    }
  }, [loadedId, refreshSaved]);

  const toggleWork = (id: string) =>
    setWorkIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const exportPdf = () => {
    setExported(true);
    window.print();
  };

  const update = (patch: Partial<PortfolioConfig>) => setConfig((c) => ({ ...c, ...patch }));

  return (
    <div className="wb">
      <div className="wb-editor">
        <section className="wb-card">
          <h2>Template — {PDF_TEMPLATE_COUNT} original templates</h2>
          <p className="wb-note">
            Original SANAA designs — not copies of any Dribbble or Pinterest design. The template sets the
            page colours, fonts, cover style and works layout.
          </p>
          <div className="wb-template-filters" role="group" aria-label="Filter templates by style">
            <button type="button" className={templateFamily === "all" ? "active" : ""} onClick={() => setTemplateFamily("all")}>
              All ({PDF_TEMPLATE_COUNT})
            </button>
            {PDF_TEMPLATE_FAMILIES.map((f) => (
              <button key={f.id} type="button" className={templateFamily === f.id ? "active" : ""} onClick={() => setTemplateFamily(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={templateQuery}
            onChange={(e) => setTemplateQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            style={{ height: 38, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--paper)", color: "var(--ink)", font: "inherit", fontSize: 13 }}
          />
          {shownTemplates.length === 0 ? (
            <p className="wb-note">No template matches this filter.</p>
          ) : (
            <div className="wb-themes">
              {shownTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`wb-theme ${templateId === t.id ? "active" : ""}`}
                  onClick={() => setTemplateId(t.id)}
                  aria-pressed={templateId === t.id}
                >
                  <span className="wb-swatch" style={{ background: t.pageBg, borderColor: t.line }}>
                    <span style={{ background: t.ink, color: t.pageBg }}>Aa</span>
                  </span>
                  <strong>{t.label}</strong>
                  <span>{t.blurb}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="wb-card">
          <h2>Portfolio content</h2>
          <label className={styles.field}>
            Portfolio title
            <input value={config.title} onChange={(e) => update({ title: e.target.value })} placeholder={`${userName} — Portfolio`} />
          </label>
          <label className={styles.field}>
            Artist name
            <input value={config.artistName} onChange={(e) => update({ artistName: e.target.value })} />
          </label>
          <label className={styles.field}>
            Bio
            <textarea value={config.bio} onChange={(e) => update({ bio: e.target.value })} rows={5} placeholder="A short bio for the portfolio…" />
          </label>
          <label className={styles.field}>
            Contact
            <textarea value={config.contact} onChange={(e) => update({ contact: e.target.value })} rows={2} placeholder="Email, website, Instagram…" />
          </label>
        </section>

        <section className="wb-card">
          <h2>Works — {selectedWorks.length} of {artworks.length} selected</h2>
          <p className="wb-note">Tick the works to include, in the order they appear in your exhibitions. The cover uses the first selected work.</p>
          <div className="wb-checks">
            {artworks.map((a) => (
              <label key={a.id} className="wb-check">
                <input type="checkbox" checked={workIds.includes(a.id)} onChange={() => toggleWork(a.id)} />
                <span>{a.title} <span className="wb-muted">— {a.exhibitionTitle}{a.year ? `, ${a.year}` : ""}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section className="wb-card">
          <h2>Export &amp; save</h2>
          <p className="wb-note">
            Export opens the print dialog — choose “Save as PDF” (A4) and the portfolio downloads as a PDF.
            Saving keeps this portfolio in your account so you can reopen and edit it later.
          </p>
          <div className="wb-actions">
            <button type="button" className="wb-btn primary" onClick={exportPdf} disabled={selectedWorks.length === 0}>
              Export PDF (print)
            </button>
            <button type="button" className="wb-btn secondary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : loadedId ? "Update saved portfolio" : "Save portfolio"}
            </button>
          </div>
          {exported && <p className="wb-msg">Print dialog opened — pick “Save as PDF” to download your portfolio.</p>}
          {saveMsg && <p className="wb-msg">{saveMsg}</p>}
          {error && <p className="wb-error" role="alert">{error}</p>}
        </section>

        <section className="wb-card">
          <h2>Saved portfolios</h2>
          {savedLoading ? (
            <p className="wb-muted">Loading…</p>
          ) : savedError ? (
            <p className="wb-error" role="alert">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="wb-muted">No saved portfolios yet.</p>
          ) : (
            <ul className="wb-saved">
              {saved.map((s) => (
                <li key={s.id}>
                  <button type="button" className="wb-saved-title" onClick={() => loadSaved(s)}>
                    {s.title}
                  </button>
                  <button type="button" className="wb-danger" onClick={() => void removeSaved(s.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="wb-preview-col">
        <div className="wb-preview-bar">
          <strong>Preview — {template.label}</strong>
          <span className="wb-muted">{selectedWorks.length} work{selectedWorks.length === 1 ? "" : "s"} · {template.worksLayout} layout</span>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: template.pageBg }}>
          <PortfolioPrint template={template} config={config} works={selectedWorks} />
        </div>
      </div>

      <style>{`
        .wb { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 28px; align-items: start; }
        @media (max-width: 1080px) { .wb { grid-template-columns: 1fr; } }
        .wb-editor { display: flex; flex-direction: column; gap: 18px; }
        .wb-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .wb-card h2 { margin: 0; font-size: 17px; font-family: Fraunces, Georgia, serif; }
        .wb-note { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
        .wb-muted { color: var(--muted); font-size: 12px; }
        .wb-themes { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .wb-template-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 4px; }
        .wb-template-filters button { padding: 6px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--ink); font: 600 12px inherit; cursor: pointer; }
        .wb-template-filters button.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .wb-theme { display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 10px; cursor: pointer; font: inherit; }
        .wb-theme strong { font-size: 14px; }
        .wb-theme span:last-child { font-size: 12px; color: var(--muted); line-height: 1.45; grid-column: 2; }
        .wb-theme.active { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
        .wb-swatch { grid-row: span 2; width: 52px; height: 52px; border: 1px solid var(--line); border-radius: 6px; display: grid; place-items: center; }
        .wb-swatch span { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
        .wb-checks { display: flex; flex-direction: column; gap: 8px; }
        .wb-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
        .wb-check input { accent-color: #ffffff; width: 16px; height: 16px; }
        .wb-btn { border-radius: 6px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid var(--ink); }
        .wb-btn.primary { background: var(--ink); color: var(--paper); }
        .wb-btn.secondary { background: transparent; color: var(--ink); }
        .wb-btn:disabled { opacity: 0.55; cursor: wait; }
        .wb-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .wb-msg { margin: 0; font-size: 13px; color: var(--muted); }
        .wb-error { margin: 0; font-size: 13px; color: #9a2b2b; }
        .wb-saved { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .wb-saved li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
        .wb-saved-title { background: none; border: none; padding: 0; cursor: pointer; font: inherit; font-weight: 600; color: var(--ink); text-align: left; }
        .wb-danger { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: #9a2b2b; }
        .wb-preview-col { position: sticky; top: 16px; }
        @media (max-width: 1080px) { .wb-preview-col { position: static; } }
        .wb-preview-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .wb-preview-bar strong { font-family: Fraunces, Georgia, serif; font-size: 17px; }
      `}</style>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SitePreview, {
  SITE_THEMES,
  defaultSiteConfig,
  siteConfigFromSaved,
  type CvEntry,
  type PressItem,
  type SiteConfig,
  type SiteExhibition,
} from "@/components/site-preview";
import styles from "@/components/tools.module.css";

// Artist Website Builder — build a portfolio site from the artist's own
// SANAA data (artworks, exhibitions, profile). Three real themes, editable
// sections, SEO fields, live responsive preview, and publishing as a real
// public page at /sites/[id] (the SavedWork row id). Custom domains are
// labelled honestly as not available yet — they need DNS + Vercel setup,
// which this tool does not fake.
//
// Design: the existing white-gallery luxury language only. Component styles
// live in the <style> block at the bottom of this file.

type SavedSite = { id: string; title: string; data: Record<string, unknown>; updatedAt: string };

type PreviewWidth = "desktop" | "tablet" | "mobile";
const PREVIEW_WIDTHS: Record<PreviewWidth, { label: string; px: number }> = {
  desktop: { label: "Desktop", px: 1100 },
  tablet: { label: "Tablet", px: 768 },
  mobile: { label: "Mobile", px: 390 },
};

const SECTIONS: { key: keyof Pick<SiteConfig, "showHero" | "showGalleries" | "showBio" | "showCv" | "showExhibitions" | "showPress" | "showContact">; label: string }[] = [
  { key: "showHero", label: "Hero" },
  { key: "showGalleries", label: "Galleries" },
  { key: "showBio", label: "Biography" },
  { key: "showCv", label: "CV" },
  { key: "showExhibitions", label: "Exhibitions list" },
  { key: "showPress", label: "Press" },
  { key: "showContact", label: "Contact" },
];

export default function WebsiteBuilder({
  userName,
  userEmail,
  exhibitions,
}: {
  userName: string;
  userEmail: string;
  exhibitions: SiteExhibition[];
}) {
  const [config, setConfig] = useState<SiteConfig>(() => defaultSiteConfig(userName, userEmail, exhibitions));
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const [saved, setSaved] = useState<SavedSite[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const allArtworks = useMemo(() => exhibitions.flatMap((e) => e.artworks), [exhibitions]);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=website");
      if (!res.ok) throw new Error("Could not load your saved sites.");
      const json = (await res.json()) as { saved: SavedSite[] };
      setSaved(json.saved ?? []);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : "Could not load your saved sites.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const update = useCallback((patch: Partial<SiteConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  const toggleExhibition = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      selectedExhibitionIds: c.selectedExhibitionIds.includes(id)
        ? c.selectedExhibitionIds.filter((x) => x !== id)
        : [...c.selectedExhibitionIds, id],
    }));
  }, []);

  const updateCv = useCallback((index: number, patch: Partial<CvEntry>) => {
    setConfig((c) => ({ ...c, cv: c.cv.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
  }, []);
  const addCv = useCallback(() => {
    setConfig((c) => ({ ...c, cv: [...c.cv, { role: "", organisation: "", year: "" }] }));
  }, []);
  const removeCv = useCallback((index: number) => {
    setConfig((c) => ({ ...c, cv: c.cv.filter((_, i) => i !== index) }));
  }, []);

  const updatePress = useCallback((index: number, patch: Partial<PressItem>) => {
    setConfig((c) => ({ ...c, press: c.press.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
  }, []);
  const addPress = useCallback(() => {
    setConfig((c) => ({ ...c, press: [...c.press, { title: "", source: "", year: "", url: "" }] }));
  }, []);
  const removePress = useCallback((index: number) => {
    setConfig((c) => ({ ...c, press: c.press.filter((_, i) => i !== index) }));
  }, []);

  const doSave = useCallback(async () => {
    const title = saveTitle.trim() || configRef.current.siteTitle.trim() || "Untitled site";
    setSaving(true);
    setSaveMsg(null);
    try {
      if (loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title, data: configRef.current }),
        });
        if (!res.ok) throw new Error("Could not update this site.");
        setSaveMsg(`Updated “${title}”. Your public page is live at /sites/${loadedId}.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "website", title, data: configRef.current }),
        });
        if (!res.ok) throw new Error("Could not save this site.");
        const json = (await res.json()) as { saved: SavedSite };
        setLoadedId(json.saved.id);
        setSaveMsg(`Saved “${title}”. Your public page is live at /sites/${json.saved.id}.`);
      }
      setSaveTitle("");
      await refreshSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save this site.");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, loadedId, refreshSaved]);

  const doLoad = useCallback(
    (row: SavedSite) => {
      setConfig(siteConfigFromSaved(row.data, userName, userEmail, exhibitions));
      setLoadedId(row.id);
      setSaveTitle(row.title);
      setSaveMsg(`Loaded “${row.title}”.`);
    },
    [userName, userEmail, exhibitions],
  );

  const doDelete = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Could not delete this site.");
        if (loadedId === id) setLoadedId(null);
        setConfirmDeleteId(null);
        await refreshSaved();
        setSaveMsg(`Deleted “${title}”. Its public page no longer exists.`);
      } catch {
        setSaveMsg("Could not delete this site.");
      }
    },
    [loadedId, refreshSaved],
  );

  const newSite = useCallback(() => {
    setConfig(defaultSiteConfig(userName, userEmail, exhibitions));
    setLoadedId(null);
    setSaveTitle("");
    setSaveMsg("Started a new site.");
  }, [userName, userEmail, exhibitions]);

  const publicUrl = loadedId ? `/sites/${loadedId}` : null;

  const copyLink = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setSaveMsg(`Copy the link from your address bar: ${publicUrl}`);
    }
  }, [publicUrl]);

  return (
    <div className="wb">
      {/* ---- Editor ---- */}
      <div className="wb-editor">
        <section className="wb-card">
          <h2>Site identity &amp; SEO</h2>
          <p className="wb-note">The title and description are what search engines and link previews show for your public page.</p>
          <label className={styles.field}>
            Site title
            <input value={config.siteTitle} onChange={(e) => update({ siteTitle: e.target.value })} />
          </label>
          <label className={styles.field}>
            Site description (SEO)
            <textarea value={config.siteDescription} rows={2} onChange={(e) => update({ siteDescription: e.target.value })} />
          </label>
          <div className="wb-row">
            <label className={styles.field}>
              Artist name
              <input value={config.artistName} onChange={(e) => update({ artistName: e.target.value })} />
            </label>
            <label className={styles.field}>
              Tagline
              <input value={config.tagline} onChange={(e) => update({ tagline: e.target.value })} placeholder="Contemporary artist" />
            </label>
          </div>
        </section>

        <section className="wb-card">
          <h2>Theme</h2>
          <div className="wb-themes">
            {SITE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wb-theme ${config.theme === t.id ? "active" : ""}`}
                onClick={() => update({ theme: t.id })}
                aria-pressed={config.theme === t.id}
              >
                <span className="wb-swatch" style={{ background: t.bg, borderColor: t.line }}>
                  <span style={{ background: t.ink, color: t.bg }}>Aa</span>
                </span>
                <strong>{t.label}</strong>
                <span>{t.blurb}</span>
              </button>
            ))}
          </div>
          <label className={styles.field}>
            Accent colour
            <span className="wb-color-row">
              <input type="color" value={config.accentColor} onChange={(e) => update({ accentColor: e.target.value })} aria-label="Accent colour" />
              <input value={config.accentColor} onChange={(e) => update({ accentColor: e.target.value })} />
            </span>
          </label>
        </section>

        <section className="wb-card">
          <h2>Sections</h2>
          <div className="wb-checks">
            {SECTIONS.map((s) => (
              <label key={s.key} className="wb-check">
                <input type="checkbox" checked={config[s.key]} onChange={(e) => update({ [s.key]: e.target.checked } as Partial<SiteConfig>)} />
                {s.label}
              </label>
            ))}
          </div>
        </section>

        <section className="wb-card">
          <h2>Hero</h2>
          <label className={styles.field}>
            Heading
            <input value={config.heroHeading} onChange={(e) => update({ heroHeading: e.target.value })} />
          </label>
          <label className={styles.field}>
            Subheading
            <input value={config.heroSubheading} onChange={(e) => update({ heroSubheading: e.target.value })} />
          </label>
          <label className={styles.field}>
            Hero artwork
            <select value={config.heroArtworkId} onChange={(e) => update({ heroArtworkId: e.target.value })}>
              <option value="">First artwork</option>
              {allArtworks.map((a) => (
                <option key={a.id} value={a.id}>{a.title} — {a.exhibitionTitle}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="wb-card">
          <h2>Galleries</h2>
          {exhibitions.length === 0 ? (
            <p className="wb-note">No exhibitions yet — your galleries will appear here once you create one.</p>
          ) : (
            <div className="wb-checks">
              {exhibitions.map((ex) => (
                <label key={ex.id} className="wb-check">
                  <input type="checkbox" checked={config.selectedExhibitionIds.includes(ex.id)} onChange={() => toggleExhibition(ex.id)} />
                  {ex.title} <span className="wb-muted">({ex.artworks.length} works)</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="wb-card">
          <h2>Biography</h2>
          <label className={styles.field}>
            Biography
            <textarea value={config.bio} rows={6} onChange={(e) => update({ bio: e.target.value })} placeholder="Write your biography in your own words…" />
          </label>
        </section>

        <section className="wb-card">
          <h2>CV</h2>
          {config.cv.map((entry, i) => (
            <div key={i} className="wb-cv-row">
              <input value={entry.year} placeholder="Year" onChange={(e) => updateCv(i, { year: e.target.value })} />
              <input value={entry.role} placeholder="Role / award" onChange={(e) => updateCv(i, { role: e.target.value })} />
              <input value={entry.organisation} placeholder="Organisation" onChange={(e) => updateCv(i, { organisation: e.target.value })} />
              <button type="button" className="wb-mini" onClick={() => removeCv(i)} aria-label="Remove CV entry">×</button>
            </div>
          ))}
          <button type="button" className="wb-btn secondary" onClick={addCv}>+ Add CV entry</button>
        </section>

        <section className="wb-card">
          <h2>Press</h2>
          {config.press.map((item, i) => (
            <div key={i} className="wb-press-row">
              <input value={item.title} placeholder="Article title" onChange={(e) => updatePress(i, { title: e.target.value })} />
              <input value={item.source} placeholder="Publication" onChange={(e) => updatePress(i, { source: e.target.value })} />
              <input value={item.year} placeholder="Year" onChange={(e) => updatePress(i, { year: e.target.value })} />
              <input value={item.url} placeholder="Link (https://…)" onChange={(e) => updatePress(i, { url: e.target.value })} />
              <button type="button" className="wb-mini" onClick={() => removePress(i)} aria-label="Remove press item">×</button>
            </div>
          ))}
          <button type="button" className="wb-btn secondary" onClick={addPress}>+ Add press item</button>
        </section>

        <section className="wb-card">
          <h2>Contact &amp; social</h2>
          <div className="wb-row">
            <label className={styles.field}>
              Email
              <input value={config.email} onChange={(e) => update({ email: e.target.value })} />
            </label>
            <label className={styles.field}>
              Website
              <input value={config.website} placeholder="https://…" onChange={(e) => update({ website: e.target.value })} />
            </label>
          </div>
          <div className="wb-row">
            <label className={styles.field}>
              Instagram
              <input value={config.instagram} placeholder="@handle" onChange={(e) => update({ instagram: e.target.value })} />
            </label>
            <label className={styles.field}>
              X / Twitter
              <input value={config.twitter} placeholder="@handle" onChange={(e) => update({ twitter: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="wb-card">
          <h2>Publish</h2>
          <p className="wb-note">
            Publishing saves your site and gives it a real public page on SANAA. Anyone with the link can view it.
            A custom domain is not available yet — it needs DNS records and Vercel domain setup, which this tool does not do.
          </p>
          <label className={styles.field}>
            Site name (for your saved list)
            <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder={config.siteTitle || "Untitled site"} />
          </label>
          <div className="wb-actions">
            <button type="button" className="wb-btn primary" onClick={() => void doSave()} disabled={saving}>
              {saving ? "Saving…" : loadedId ? "Update & publish" : "Save & publish"}
            </button>
            <button type="button" className="wb-btn secondary" onClick={newSite}>New site</button>
          </div>
          {saveMsg && <p className="wb-msg" role="status">{saveMsg}</p>}
          {publicUrl && (
            <p className="wb-public">
              Public page: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>{" "}
              <button type="button" className="wb-btn secondary" onClick={() => void copyLink()}>{copied ? "Copied!" : "Copy link"}</button>
            </p>
          )}
        </section>

        <section className="wb-card">
          <h2>Your saved sites</h2>
          {savedLoading ? (
            <p className="wb-note">Loading your saved sites…</p>
          ) : savedError ? (
            <p className="wb-error">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="wb-note">No saved sites yet. Save this one to publish it and find it here later.</p>
          ) : (
            <ul className="wb-saved">
              {saved.map((row) => (
                <li key={row.id}>
                  <button type="button" className="wb-saved-title" onClick={() => doLoad(row)}>
                    {row.title}
                  </button>
                  <span className="wb-muted">{new Date(row.updatedAt).toLocaleDateString()}</span>
                  <a href={`/sites/${row.id}`} target="_blank" rel="noreferrer">View</a>
                  {confirmDeleteId === row.id ? (
                    <>
                      <button type="button" className="wb-danger" onClick={() => void doDelete(row.id, row.title)}>Confirm delete</button>
                      <button type="button" className="wb-btn secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="wb-danger" onClick={() => setConfirmDeleteId(row.id)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Live preview ---- */}
      <div className="wb-preview-col">
        <div className="wb-preview-bar">
          <strong>Live preview</strong>
          <div className="wb-widths" role="group" aria-label="Preview width">
            {(Object.keys(PREVIEW_WIDTHS) as PreviewWidth[]).map((w) => (
              <button
                key={w}
                type="button"
                className={previewWidth === w ? "active" : ""}
                onClick={() => setPreviewWidth(w)}
                aria-pressed={previewWidth === w}
              >
                {PREVIEW_WIDTHS[w].label}
              </button>
            ))}
          </div>
        </div>
        <div className="wb-preview-frame">
          <SitePreview config={config} exhibitions={exhibitions} maxWidth={PREVIEW_WIDTHS[previewWidth].px} />
        </div>
      </div>

      <style>{`
        .wb { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 28px; align-items: start; }
        @media (max-width: 1080px) { .wb { grid-template-columns: 1fr; } }
        .wb-editor { display: flex; flex-direction: column; gap: 18px; }
        .wb-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .wb-card h2 { margin: 0; font-size: 17px; font-family: Fraunces, Georgia, serif; }
        .wb-card textarea { padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 14px; resize: vertical; }
        .wb-note { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
        .wb-muted { color: var(--muted); font-size: 12px; }
        .wb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .wb-row { grid-template-columns: 1fr; } }
        .wb-themes { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .wb-theme { display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 10px; cursor: pointer; font: inherit; }
        .wb-theme strong { font-size: 14px; }
        .wb-theme span:last-child { font-size: 12px; color: var(--muted); line-height: 1.45; grid-column: 2; }
        .wb-theme.active { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
        .wb-swatch { grid-row: span 2; width: 52px; height: 52px; border: 1px solid var(--line); border-radius: 6px; display: grid; place-items: center; }
        .wb-swatch span { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
        .wb-color-row { display: flex; gap: 8px; align-items: center; }
        .wb-color-row input[type="color"] { width: 44px; height: 40px; padding: 2px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); cursor: pointer; }
        .wb-color-row input:last-child { flex: 1; }
        .wb-checks { display: flex; flex-direction: column; gap: 8px; }
        .wb-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
        .wb-check input { accent-color: #ffffff; width: 16px; height: 16px; }
        .wb-cv-row, .wb-press-row { display: grid; gap: 8px; }
        .wb-cv-row { grid-template-columns: 64px 1fr 1fr 28px; }
        .wb-press-row { grid-template-columns: 1fr 1fr 64px 1fr 28px; }
        @media (max-width: 560px) { .wb-cv-row, .wb-press-row { grid-template-columns: 1fr 28px; } }
        .wb-cv-row input, .wb-press-row input { height: 38px; padding: 0 8px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 13px; min-width: 0; }
        .wb-mini { border: 1px solid var(--line); background: var(--paper); color: var(--ink); border-radius: 5px; cursor: pointer; font-size: 16px; line-height: 1; }
        .wb-btn { border-radius: 6px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid var(--ink); }
        .wb-btn.primary { background: var(--ink); color: var(--paper); }
        .wb-btn.secondary { background: transparent; color: var(--ink); }
        .wb-btn:disabled { opacity: 0.55; cursor: wait; }
        .wb-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .wb-msg { margin: 0; font-size: 13px; color: var(--muted); }
        .wb-error { margin: 0; font-size: 13px; color: #9a2b2b; }
        .wb-public { margin: 0; font-size: 13px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .wb-public a { color: #ffffff; }
        .wb-saved { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .wb-saved li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
        .wb-saved-title { background: none; border: none; padding: 0; cursor: pointer; font: inherit; font-weight: 600; color: var(--ink); text-align: left; }
        .wb-saved a { color: #ffffff; }
        .wb-danger { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: #9a2b2b; }
        .wb-preview-col { position: sticky; top: 16px; }
        @media (max-width: 1080px) { .wb-preview-col { position: static; } }
        .wb-preview-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .wb-preview-bar strong { font-family: Fraunces, Georgia, serif; font-size: 17px; }
        .wb-widths { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
        .wb-widths button { border: none; background: var(--paper); color: var(--ink); padding: 8px 12px; font: inherit; font-size: 13px; cursor: pointer; border-right: 1px solid var(--line); }
        .wb-widths button:last-child { border-right: none; }
        .wb-widths button.active { background: var(--ink); color: var(--paper); }
        .wb-preview-frame { background: #ece9e3; border: 1px solid var(--line); border-radius: 10px; padding: 16px; overflow-x: auto; }
      `}</style>
    </div>
  );
}

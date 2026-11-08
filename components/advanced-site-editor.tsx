// Advanced website builder editor (Claude « atelier-sites », integrated
// 8 Nov 2026). Adapted from the standalone builder's src/app/page.tsx:
//  - drafts persist in PostgreSQL via /api/advanced-sites (autosave),
//    NOT in localStorage (the standalone builder's only persistence);
//  - media uploads go to R2 via /api/advanced-media (4.5 MB cap),
//    NOT to public/uploads on local disk;
//  - templates come from the Template table (prop), sites from the
//    Site table (prop); every call is owner-scoped server-side;
//  - slugs are made unique per site (template ids alone would collide
//    across users, since slug is the public URL).
// The simple SANAA builder was removed on 8 Nov 2026 (Kabeya's
// decision: keep only this advanced builder). /tools/website-builder
// now redirects here.
"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Instagram, Mail, Music, Play } from "lucide-react";
import { blockLibrary, createTemplateSite } from "@/lib/advanced-site-templates";
import type { Block, BlockType, Section, SiteDocument, SitePage, TemplateSummary, Theme } from "@/lib/advanced-site-types";

type PanelName = "Modèles" | "Sections" | "Blocs" | "Médias" | "Pages" | "Thème";
type Device = "ordinateur" | "tablette" | "mobile";

const panelItems: Array<{ label: PanelName; icon: string }> = [
  { label: "Modèles", icon: "▦" },
  { label: "Sections", icon: "☷" },
  { label: "Blocs", icon: "▤" },
  { label: "Médias", icon: "▧" },
  { label: "Pages", icon: "▱" },
  { label: "Thème", icon: "◉" }
];

const makeId = () => Math.random().toString(36).slice(2, 10);
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdvancedSiteEditor({ initialSites, templates }: { initialSites: SiteDocument[]; templates: TemplateSummary[] }) {
  // A fresh site from a template gets a unique slug: the template id
  // alone would collide with every other user's site from that template.
  function newSiteFromTemplate(template: TemplateSummary): SiteDocument {
    const fresh = createTemplateSite(template);
    fresh.slug = `${template.id}-${makeId().slice(0, 4)}`;
    return fresh;
  }
  const defaultTemplate = templates.find((template) => template.id === "atelier-ambre") ?? templates[0];
  const [site, setSite] = useState<SiteDocument>(() => initialSites[0] ?? newSiteFromTemplate(defaultTemplate));
  const siteRef = useRef(site);
  const historyRef = useRef<SiteDocument[]>([site]);
  const historyIndex = useRef(0);
  const [savedSites, setSavedSites] = useState<SiteDocument[]>(initialSites);
  const dirtyRef = useRef(false);
  const [sitesMenuOpen, setSitesMenuOpen] = useState(false);
  const [pendingDeleteSiteId, setPendingDeleteSiteId] = useState("");
  const [activePanel, setActivePanel] = useState<PanelName>("Modèles");
  const [rightOpen, setRightOpen] = useState(true);
  const [activePageId, setActivePageId] = useState(site.pages[0].id);
  const [selectedSectionId, setSelectedSectionId] = useState(site.pages[0].sections[0]?.id ?? "");
  const [device, setDevice] = useState<Device>("ordinateur");
  const [previewMode, setPreviewMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [media, setMedia] = useState<Array<{ url: string; name: string }>>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const activePage = site.pages.find((page) => page.id === activePageId) ?? site.pages[0];
  const selectedSection = activePage?.sections.find((section) => section.id === selectedSectionId) ?? activePage?.sections[0];
  const selectedBlock = selectedSection?.blocks[0];

  // Media library for the active site, from PostgreSQL (Media rows).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/advanced-media?siteId=${encodeURIComponent(site.id)}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((items: unknown) => {
        if (cancelled || !Array.isArray(items)) return;
        setMedia(items.filter((item): item is { url: string; name: string } =>
          Boolean(item) && typeof item === "object" && typeof (item as { url?: unknown }).url === "string" && typeof (item as { name?: unknown }).name === "string"));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // Reload when the active site changes (id only — not on every edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  // Autosave to PostgreSQL (debounced): only after a real edit
  // (dirtyRef), never on first render — opening the editor must not
  // create a site row for a user who changes nothing.
  async function saveSiteDoc(doc: SiteDocument): Promise<boolean> {
    setSaving(true);
    try {
      const response = await fetch("/api/advanced-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const details = result && typeof result === "object" && "error" in result ? String(result.error) : "Enregistrement impossible.";
        throw new Error(details);
      }
      dirtyRef.current = false;
      setSavedSites((current) => {
        const exists = current.some((item) => item.id === doc.id);
        return exists ? current.map((item) => (item.id === doc.id ? doc : item)) : [...current, doc];
      });
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => { void saveSiteDoc(siteRef.current); }, 800);
    setSaving(true);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  useEffect(() => {
    function handleShortcuts(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveSiteDoc(siteRef.current).then((ok) => {
          if (ok) setMessage("Brouillon enregistré dans votre compte.");
        });
      }
    }
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, []);

  function isSiteDocument(value: unknown): value is SiteDocument {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SiteDocument>;
    return typeof candidate.id === "string" && typeof candidate.title === "string" &&
      Array.isArray(candidate.pages) && Boolean(candidate.theme) &&
      candidate.pages.every((page) => typeof page.id === "string" && Array.isArray(page.sections));
  }

  function commit(recipe: (current: SiteDocument) => SiteDocument) {
    dirtyRef.current = true;
    const next = recipe(siteRef.current);
    siteRef.current = next;
    const nextHistory = historyRef.current.slice(0, historyIndex.current + 1);
    nextHistory.push(next);
    historyRef.current = nextHistory.slice(-51);
    historyIndex.current = historyRef.current.length - 1;
    setSite(next);
    setMessage("");
    setError("");
  }

  function undo() {
    if (historyIndex.current <= 0) return;
    historyIndex.current -= 1;
    const previous = historyRef.current[historyIndex.current];
    siteRef.current = previous;
    setSite(previous);
  }

  function redo() {
    if (historyIndex.current >= historyRef.current.length - 1) return;
    historyIndex.current += 1;
    const next = historyRef.current[historyIndex.current];
    siteRef.current = next;
    setSite(next);
  }

  function patchSite(patch: Partial<SiteDocument>) {
    commit((current) => ({ ...current, ...patch }));
  }

  function patchPage(pageId: string, patch: Partial<SitePage>) {
    commit((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === pageId ? { ...page, ...patch } : page)
    }));
  }

  function patchBlock(blockId: string, field: string, value: string) {
    commit((current) => ({
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) => block.id === blockId
            ? { ...block, content: { ...block.content, [field]: value } }
            : block)
        }))
      }))
    }));
  }

  function patchTheme(path: "colors" | "typography" | "buttons", key: string, value: string | number) {
    commit((current) => {
      const existing = current.theme[path];
      const theme = {
        ...current.theme,
        [path]: { ...existing, [key]: value }
      } as Theme;
      return { ...current, theme };
    });
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const next = createTemplateSite(template);
    next.id = site.id;
    next.slug = site.slug;
    next.publishedSlug = site.publishedSlug ?? (site.published ? site.slug : null);
    siteRef.current = next;
    historyRef.current = [...historyRef.current.slice(0, historyIndex.current + 1), next].slice(-51);
    historyIndex.current = historyRef.current.length - 1;
    setSite(next);
    setActivePageId(next.pages[0].id);
    setSelectedSectionId(next.pages[0].sections[0]?.id ?? "");
    setMessage(`Le modèle « ${template.name} » est prêt à personnaliser.`);
    setError("");
    setActivePanel("Pages");
  }

  function activateSite(next: SiteDocument) {
    siteRef.current = next;
    setSite(next);
    historyRef.current = [next];
    historyIndex.current = 0;
    setActivePageId(next.pages[0]?.id ?? "");
    setSelectedSectionId(next.pages[0]?.sections[0]?.id ?? "");
    setSitesMenuOpen(false);
    setPendingDeleteSiteId("");
    setMessage("");
    setError("");
  }

  function createSite() {
    const next = newSiteFromTemplate(defaultTemplate);
    next.title = "Mon portfolio";
    next.slug = `mon-portfolio-${makeId().slice(0, 4)}`;
    next.pages[0].title = "Accueil";
    next.pages[0].seoTitle = "Mon portfolio — Artiste";
    setSavedSites((current) => [...current, next]);
    activateSite(next);
    dirtyRef.current = true;
    void saveSiteDoc(next);
    setMessage("Nouveau site créé à partir d'une base créative.");
  }

  function duplicateSite(source: SiteDocument) {
    const duplicate: SiteDocument = {
      ...source,
      id: makeId(),
      slug: `${source.slug}-copie-${makeId().slice(0, 4)}`,
      title: `${source.title} (copie)`,
      published: false,
      publishedSlug: null,
      pages: source.pages.map((page) => ({
        ...page,
        id: makeId(),
        sections: page.sections.map((section) => ({
          ...section,
          id: makeId(),
          blocks: section.blocks.map((block) => ({ ...block, id: makeId(), content: { ...block.content } }))
        }))
      }))
    };
    const updated = [...savedSites, duplicate];
    setSavedSites(updated);
    activateSite(duplicate);
    dirtyRef.current = true;
    void saveSiteDoc(duplicate);
    setMessage("Copie du site créée. Elle est enregistrée comme brouillon.");
  }

  async function deleteSite(siteId: string) {
    const updated = savedSites.filter((item) => item.id !== siteId);
    if (updated.length === 0 && site.id === siteId) {
      setError("Gardez au moins un site dans votre espace.");
      setPendingDeleteSiteId("");
      return;
    }
    try {
      const response = await fetch(`/api/advanced-sites/${encodeURIComponent(siteId)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        const result: unknown = await response.json().catch(() => null);
        const details = result && typeof result === "object" && "error" in result ? String(result.error) : "Erreur inconnue";
        throw new Error(details);
      }
    } catch (reason) {
      setError(reason instanceof Error ? `Suppression impossible : ${reason.message}` : "Suppression impossible. Réessayez.");
      setPendingDeleteSiteId("");
      return;
    }
    setSavedSites(updated);
    if (site.id === siteId && updated.length > 0) activateSite(updated[0]);
    setPendingDeleteSiteId("");
    setMessage("Le site a été supprimé.");
  }

  function addBlock(type: BlockType) {
    if (!activePage) return;
    const definition = blockLibrary.find((item) => item.type === type);
    const block: Block = {
      id: makeId(),
      type,
      content: { heading: definition?.label ?? "Nouvelle section", body: definition?.description ?? "", label: "", image: "", action: "En savoir plus", items: ["Nouvel élément"] }
    };
    const section: Section = { id: makeId(), title: definition?.label ?? "Nouvelle section", blocks: [block] };
    const pageId = activePage.id;
    commit((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === pageId ? { ...page, sections: [...page.sections, section] } : page)
    }));
    setSelectedSectionId(section.id);
  }

  function removeSection(sectionId: string) {
    if (!activePage) return;
    const sections = activePage.sections.filter((section) => section.id !== sectionId);
    if (!sections.length) {
      setError("Une page doit conserver au moins une section.");
      return;
    }
    patchPage(activePage.id, { sections });
    if (selectedSectionId === sectionId) setSelectedSectionId(sections[0].id);
  }

  function duplicateSection(sectionId: string) {
    if (!activePage) return;
    const source = activePage.sections.find((section) => section.id === sectionId);
    if (!source) return;
    const duplicate: Section = {
      ...source,
      id: makeId(),
      title: `${source.title} (copie)`,
      blocks: source.blocks.map((block) => ({ ...block, id: makeId(), content: { ...block.content } }))
    };
    const index = activePage.sections.findIndex((section) => section.id === sectionId);
    const sections = [...activePage.sections];
    sections.splice(index + 1, 0, duplicate);
    patchPage(activePage.id, { sections });
    setSelectedSectionId(duplicate.id);
  }

  function reorderSection(sourceId: string, targetId: string) {
    if (!activePage || sourceId === targetId) return;
    const sections = [...activePage.sections];
    const from = sections.findIndex((section) => section.id === sourceId);
    const to = sections.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    patchPage(activePage.id, { sections });
  }

  function addPage() {
    const page: SitePage = {
      id: makeId(), slug: `page-${site.pages.length + 1}`, title: "Nouvelle page",
      seoTitle: `${site.title} — Nouvelle page`, seoDescription: "Découvrez mon travail et mes actualités.",
      sections: [{ id: makeId(), title: "Présentation", blocks: [{ id: makeId(), type: "hero", content: { heading: "Bienvenue sur cette page", body: "Ajoutez votre texte de présentation.", label: site.title, action: "Découvrir", image: "" } }] }]
    };
    commit((current) => ({ ...current, pages: [...current.pages, page] }));
    setActivePageId(page.id);
    setSelectedSectionId(page.sections[0].id);
  }

  function movePage(pageId: string, offset: number) {
    const pages = [...site.pages];
    const index = pages.findIndex((page) => page.id === pageId);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= pages.length) return;
    [pages[index], pages[destination]] = [pages[destination], pages[index]];
    commit((current) => ({ ...current, pages }));
  }

  function deletePage(pageId: string) {
    if (site.pages.length === 1) {
      setError("Le site doit conserver au moins une page.");
      return;
    }
    const pages = site.pages.filter((page) => page.id !== pageId);
    commit((current) => ({ ...current, pages }));
    if (activePageId === pageId) {
      setActivePageId(pages[0].id);
      setSelectedSectionId(pages[0].sections[0]?.id ?? "");
    }
  }

  async function publish() {
    setSaving(true);
    setError("");
    const payload = { ...siteRef.current, published: true };
    try {
      const response = await fetch("/api/advanced-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const details = result && typeof result === "object" && "error" in result ? String(result.error) : "Erreur inconnue";
        throw new Error(details);
      }
      commit((current) => ({ ...current, published: true, publishedSlug: current.slug }));
      setMessage(`Votre site est publié : /sites/${siteRef.current.slug}`);
    } catch (reason) {
      setError(reason instanceof Error ? `Publication impossible : ${reason.message}` : "Publication impossible. Vérifiez la connexion à la base de données.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format non pris en charge. Choisissez une image JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 4_500_000) {
      setError("L'image dépasse la limite de 4,5 Mo.");
      event.target.value = "";
      return;
    }
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("siteId", site.id);
    try {
      const response = await fetch("/api/advanced-media", { method: "POST", body });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
        throw new Error(result && typeof result === "object" && "error" in result ? String(result.error) : "Le transfert a échoué.");
      }
      const uploaded = { url: String(result.url), name: file.name };
      setMedia((items) => [uploaded, ...items]);
      if (selectedBlock) patchBlock(selectedBlock.id, "image", uploaded.url);
      setMessage("Image importée et ajoutée à la bibliothèque.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le transfert de l'image a échoué.");
    } finally {
      event.target.value = "";
    }
  }

  const canvasWidth = device === "ordinateur" ? "100%" : device === "tablette" ? "768px" : "390px";
  const themeStyle = useMemo(() => ({
    "--site-bg": site.theme.colors.background,
    "--site-text": site.theme.colors.text,
    "--site-primary": site.theme.colors.primary,
    "--site-secondary": site.theme.colors.secondary,
    "--site-accent": site.theme.colors.accent,
    "--site-h1": `${site.theme.typography.h1}px`,
    "--site-h2": `${site.theme.typography.h2}px`,
    "--site-h3": `${site.theme.typography.h3}px`,
    "--site-body": `${site.theme.typography.body}px`,
    "--site-radius": `${site.theme.buttons.radius}px`,
    "--site-heading-font": site.theme.typography.headingFont,
    "--site-body-font": site.theme.typography.bodyFont
  }) as React.CSSProperties, [site.theme]);

  return (
    <main className={`advanced-editor editor-shell ${previewMode ? "preview-mode" : ""}`}>
      <header className="topbar">
        <div className="top-left">
          <div className="brand-mark">a</div>
          <span className="brand-name">{previewMode ? site.title : "atelier"}</span>
          {!previewMode && <>
          <div className="sites-menu-wrap">
            <button className="button" onClick={() => setSitesMenuOpen((open) => !open)}>Mes sites⌄</button>
            {sitesMenuOpen && <div className="sites-popover">
              <strong>Vos sites</strong>
              {savedSites.map((item) => <div className="site-manager-row" key={item.id}>
                <button className="site-manager-select" onClick={() => activateSite(item)}>
                  <span>{item.title}</span><small>{item.published ? "Publié" : "Brouillon"}</small>
                </button>
                {pendingDeleteSiteId === item.id
                  ? <button className="small-button" title="Confirmer la suppression" onClick={() => deleteSite(item.id)}>Confirmer</button>
                  : <button className="small-button" title="Supprimer le site" onClick={() => setPendingDeleteSiteId(item.id)}>×</button>}
              </div>)}
              <div className="site-manager-actions">
                <button className="button" onClick={createSite}>＋ Nouveau</button>
                <button className="button" onClick={() => duplicateSite(site)}>Dupliquer l'actuel</button>
              </div>
            </div>}
          </div>
          <input className="site-title-input" aria-label="Nom du site" value={site.title} onChange={(event) => {
            const title = event.target.value;
            const slug = slugify(title) || "mon-portfolio";
            if (savedSites.some((item) => item.id !== site.id && item.slug === slug)) {
              setError("Ce nom de site est déjà utilisé dans votre espace.");
              return;
            }
            patchSite({ title, slug });
          }} />
          </>}
        </div>
        <div className="top-tools">
          {!previewMode && <>
            <button className="icon-button" title="Annuler (Ctrl+Z)" onClick={undo}>↶</button>
            <button className="icon-button" title="Rétablir (Ctrl+Y)" onClick={redo}>↷</button>
          </>}
          <div className="device-switch" aria-label="Aperçu par appareil">
            {(["ordinateur", "tablette", "mobile"] as Device[]).map((value) => (
              <button key={value} className={device === value ? "active" : ""} title={value} onClick={() => setDevice(value)}>
                {value === "ordinateur" ? "▰" : value === "tablette" ? "▯" : "▯"}
              </button>
            ))}
          </div>
          {!previewMode && <>
            <button className="button" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
            <span style={{ fontSize: 11, minWidth: 32, textAlign: "center" }}>{zoom}%</span>
            <button className="button" onClick={() => setZoom((value) => Math.min(120, value + 10))}>+</button>
          </>}
        </div>
        <div className="top-right">
          {!previewMode && <>
            <span className="save-label" style={{ fontSize: 10, color: "#777" }}>{saving ? "Enregistrement…" : "Enregistré"}</span>
            <button className="button" onClick={() => { void saveSiteDoc(siteRef.current).then((ok) => { if (ok) setMessage("Brouillon enregistré dans votre compte."); }); }}>Enregistrer</button>
            <button className="button" onClick={() => setPreviewMode(true)}>Aperçu</button>
          </>}
          {previewMode && <button className="button" onClick={() => setPreviewMode(false)}>Quitter l’aperçu</button>}
          <button className="button primary" onClick={publish} disabled={saving}>{site.published ? "Mettre à jour" : "Publier"}</button>
        </div>
      </header>

      <div className="workarea">
        <nav className="leftbar" aria-label="Outils du site">
          {panelItems.map((item) => (
            <button key={item.label} className={`nav-item ${activePanel === item.label ? "active" : ""}`} onClick={() => setActivePanel(item.label)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>

        <aside className="panel" aria-label={`Panneau ${activePanel}`}>
          {activePanel === "Modèles" && <TemplatePanel templates={templates} onApply={applyTemplate} />}
          {activePanel === "Sections" && <BlockPanel heading="Sections" intro="Ajoutez une structure prête à personnaliser." onAdd={addBlock} types={["hero", "text", "gallery", "events", "footer", "divider"]} />}
          {activePanel === "Blocs" && <BlockPanel heading="Bibliothèque de blocs" intro="Ajoutez des éléments réutilisables à cette page." onAdd={addBlock} types={blockLibrary.map((block) => block.type)} />}
          {activePanel === "Médias" && <MediaPanel media={media} inputRef={fileInput} onUpload={uploadMedia} onChoose={(url) => selectedBlock && patchBlock(selectedBlock.id, "image", url)} />}
          {activePanel === "Pages" && <PagesPanel pages={site.pages} activePageId={activePage.id} onSelect={(page) => { setActivePageId(page.id); setSelectedSectionId(page.sections[0]?.id ?? ""); }} onAdd={addPage} onMove={movePage} onDelete={deletePage} />}
          {activePanel === "Thème" && <ThemePanel theme={site.theme} onChange={patchTheme} />}
        </aside>

        <section className="content-area">
          <div className="canvas-toolbar">
            <span><span className={`status-dot ${site.published ? "" : "draft"}`} />{site.published ? "Publié" : "Brouillon"}</span>
            <span>›</span><strong style={{ color: "#4b4740" }}>{activePage.title}</strong>
            <span style={{ marginLeft: 8 }}>↕ Glissez les sections pour les réorganiser</span>
          </div>
          <div className="canvas-outer">
            <div className={`canvas-wrap design-${site.design ?? "minimal"} ${site.templateId === "portfolio-editorial" ? "canvas-editorial" : ""}`} style={{ width: canvasWidth, minWidth: device === "ordinateur" ? 600 : undefined, zoom: zoom / 100, ...themeStyle }}>
              <div className="canvas-site-nav" style={{ color: site.theme.colors.text, fontFamily: site.theme.typography.headingFont }}>
                <strong>{site.title}</strong>
                <div className={previewMode ? "canvas-preview-nav" : ""}>{site.pages.map((page) => previewMode
                  ? <button className={`preview-page-link ${activePage.id === page.id ? "current" : ""}`} aria-current={activePage.id === page.id ? "page" : undefined} key={page.id} onClick={() => { setActivePageId(page.id); setSelectedSectionId(page.sections[0]?.id ?? ""); }}>{page.title}</button>
                  : <span key={page.id}>{page.title}</span>)}</div>
              </div>
              {activePage.sections.map((section, index) => {
                const block = section.blocks[0];
                if (!block) return null;
                const headingTag = index === 0 ? "h1" : index === 1 ? "h2" : "h3";
                const PreviewHeading = headingTag;
                const previewHeadingSize = `clamp(20px, ${site.theme.typography[headingTag] * (device === "mobile" ? 0.62 : 1)}px, 72px)`;
                return (
                  <div key={section.id} draggable className={`canvas-section design-section section-${block.type} ${site.templateId === "portfolio-editorial" ? "editorial-section" : ""} ${site.templateId === "portfolio-editorial" && block.type === "hero" ? `editorial-hero ${block.content.image ? "has-editorial-image" : ""}` : ""} ${site.templateId === "portfolio-editorial" && block.type === "gallery" ? "editorial-gallery" : ""} ${selectedSectionId === section.id ? "selected" : ""}`}
                    onClick={() => setSelectedSectionId(section.id)}
                    onDragStart={(event: DragEvent<HTMLDivElement>) => event.dataTransfer.setData("text/plain", section.id)}
                    onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("drag-over"); }}
                    onDragLeave={(event) => event.currentTarget.classList.remove("drag-over")}
                    onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove("drag-over"); reorderSection(event.dataTransfer.getData("text/plain"), section.id); }}>
                    <span className="section-caption">{section.title} · {index + 1}</span>
                    <div className="preview-eyebrow" style={{ color: site.theme.colors.primary }}>{String(block.content.label ?? site.title)}</div>
                    {editingField === `${block.id}:heading`
                      ? <textarea autoFocus className="field field-textarea" value={String(block.content.heading ?? "")} onChange={(event) => patchBlock(block.id, "heading", event.target.value)} onBlur={() => setEditingField(null)} />
                      : <PreviewHeading className="preview-heading" onDoubleClick={() => setEditingField(`${block.id}:heading`)} style={{ fontFamily: site.theme.typography.headingFont, fontSize: previewHeadingSize, color: site.theme.colors.text, "--preview-heading-size": previewHeadingSize } as React.CSSProperties}>
                        {String(block.content.heading ?? section.title)}
                      </PreviewHeading>}
                    {editingField === `${block.id}:body`
                      ? <textarea autoFocus className="field field-textarea" value={String(block.content.body ?? "")} onChange={(event) => patchBlock(block.id, "body", event.target.value)} onBlur={() => setEditingField(null)} />
                      : <p className="preview-body" onDoubleClick={() => setEditingField(`${block.id}:body`)} style={{ fontFamily: site.theme.typography.bodyFont, fontSize: `${site.theme.typography.body}px`, color: site.theme.colors.text }}>
                        {String(block.content.body ?? "")}
                      </p>}
                    {block.content.image && block.type !== "gallery" && <img className={site.templateId === "portfolio-editorial" && block.type === "hero" ? "editorial-portrait-image" : ""} src={String(block.content.image)} alt={String(block.content.heading ?? "")} style={{ maxWidth: "100%", maxHeight: 360, objectFit: "cover", marginTop: 16 }} />}
                    {block.type === "gallery" && <div className="preview-gallery">{(Array.isArray(block.content.items) ? block.content.items : ["Œuvre n° 1", "Étude de lumière", "Série récente"]).map((item, itemIndex) => {
                      const images = Array.isArray(block.content.images) ? block.content.images : [];
                      const captions = Array.isArray(block.content.imageCaptions) ? block.content.imageCaptions : [];
                      const image = images[itemIndex];
                      return <div key={`${item}-${itemIndex}`} className="gallery-tile">{typeof image === "string" && <img src={image} alt={String(captions[itemIndex] ?? item)} loading="lazy" />}<span>{String(captions[itemIndex] ?? item)}</span></div>;
                    })}</div>}
                    {block.type === "events" && <div className="preview-card"><strong>{String(block.content.body ?? "Prochain rendez-vous")}</strong><p style={{ fontSize: 11, opacity: .7 }}>Entrée libre · Réservation conseillée</p></div>}
                    {block.type === "audio" && <div className="preview-card"><Music size={13} aria-hidden="true" />Lecture audio · Écouter un extrait</div>}
                    {block.type === "video" && <div className="preview-card"><Play size={13} aria-hidden="true" />Voir le film · Showreel</div>}
                    {block.type === "contact" && <div className="preview-card"><Mail size={13} aria-hidden="true" />Votre adresse e-mail</div>}
                    {block.type === "social" && <div className="preview-social">{(Array.isArray(block.content.items) ? block.content.items : ["Instagram", "Vimeo", "Newsletter"]).map((item) => { const label = String(item); const Icon = /instagram/i.test(label) ? Instagram : /mail|newsletter/i.test(label) ? Mail : Globe; return <span key={label}><Icon size={13} aria-hidden="true" />{label}</span>; })}</div>}
                    {block.type === "footer" && <div className="preview-footer"><strong>{String(block.content.heading ?? site.title)}</strong><span>© {new Date().getFullYear()} · Navigation · Contact · Réseaux sociaux</span></div>}
                    {["hero", "cta", "pricing"].includes(block.type) && <button className="preview-action" style={{ background: site.theme.buttons.style === "plein" ? site.theme.colors.primary : "transparent", color: site.theme.buttons.style === "plein" ? "#fff" : site.theme.colors.primary, border: `1px solid ${site.theme.colors.primary}`, borderRadius: `${site.theme.buttons.radius}px` }}>{String(block.content.action ?? "Découvrir")}</button>}
                    {!["hero", "text", "image", "gallery", "events", "audio", "video", "contact", "cta", "pricing", "divider", "footer", "social"].includes(block.type) && <div className="preview-card">{String((Array.isArray(block.content.items) ? block.content.items[0] : undefined) ?? block.content.body ?? "")}</div>}
                    {block.type === "divider" && <hr style={{ marginTop: 26, border: 0, borderTop: `1px solid ${site.theme.colors.secondary}` }} />}
                    <div className="section-controls" style={{ position: "absolute", right: 7, top: 7, display: selectedSectionId === section.id ? "flex" : "none", gap: 4 }}>
                      <button className="small-button" aria-label="Dupliquer la section" title="Dupliquer" onClick={(event) => { event.stopPropagation(); duplicateSection(section.id); }}>⧉</button>
                      <button className="small-button" aria-label="Supprimer la section" title="Supprimer" onClick={(event) => { event.stopPropagation(); removeSection(section.id); }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {rightOpen ? <aside className="panel panel-right" aria-label="Propriétés">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div><h2 className="panel-title">Propriétés</h2><p className="panel-subtitle">Ajustez l'élément sélectionné.</p></div>
            <button className="small-button" aria-label="Fermer le panneau" onClick={() => setRightOpen(false)}>×</button>
          </div>
          {selectedBlock ? <BlockProperties block={selectedBlock} section={selectedSection} page={activePage} onBlockChange={patchBlock} onSectionRename={(title) => {
            commit((current) => ({ ...current, pages: current.pages.map((page) => ({ ...page, sections: page.sections.map((item) => item.id === selectedSection.id ? { ...item, title } : item) })) }));
          }} onPageChange={(patch) => {
            if (patch.slug && site.pages.some((page) => page.id !== activePage.id && page.slug === patch.slug)) {
              setError("Une autre page utilise déjà ce nom d'URL.");
              return;
            }
            patchPage(activePage.id, patch);
          }} />
            : <p className="panel-subtitle">Sélectionnez une section sur le canevas pour modifier son contenu.</p>}
        </aside> : <button className="button" style={{ margin: 8, alignSelf: "start" }} onClick={() => setRightOpen(true)}>Propriétés</button>}
      </div>

      {(message || error) && <div style={{ position: "fixed", zIndex: 10, bottom: 17, left: "50%", transform: "translateX(-50%)", width: "min(520px, calc(100vw - 24px))" }}>
        {message && <div className="notice" role="status">{message}</div>}
        {error && <div className="error-message" role="alert">{error}</div>}
      </div>}
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadMedia} />
    </main>
  );
}

function TemplatePanel({ templates, onApply }: { templates: TemplateSummary[]; onApply: (templateId: string) => void }) {
  return <><h2 className="panel-title">Modèles créatifs</h2><p className="panel-subtitle">Des univers originaux, conçus pour les artistes.</p>
    <label className="panel-label">{templates.length} modèles · tous les métiers</label>
    {templates.map((template) => <article className="template-card" key={template.id}>
      <div className={`template-preview design-${template.design}`} style={{ background: `linear-gradient(180deg, #0000000a, #000000a6), url("${template.coverImage ?? ""}"), linear-gradient(135deg, ${template.colors.primary}, ${template.colors.accent})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <span className="template-preview-label">{template.category}</span>
        <span /><span /><span className="template-preview-mark">{template.hero}</span>
      </div>
      <div className="template-card-info">
        <strong>{template.name} <small style={{ fontWeight: 400, color: "#817b72" }}>· {template.category}</small></strong>
        <p>{template.description}</p>
        <button className="button" style={{ width: "100%" }} onClick={() => onApply(template.id)}>Utiliser ce modèle</button>
      </div>
    </article>)}
  </>;
}

function BlockPanel({ heading, intro, types, onAdd }: { heading: string; intro: string; types: BlockType[]; onAdd: (type: BlockType) => void }) {
  return <><h2 className="panel-title">{heading}</h2><p className="panel-subtitle">{intro}</p>
    {types.map((type) => {
      const block = blockLibrary.find((item) => item.type === type);
      if (!block) return null;
      return <div key={type} className="library-row"><div><strong>{block.label}</strong><small>{block.description}</small></div><button className="small-button" aria-label={`Ajouter ${block.label}`} onClick={() => onAdd(type)}>＋</button></div>;
    })}
  </>;
}

function PagesPanel({ pages, activePageId, onSelect, onAdd, onMove, onDelete }: {
  pages: SitePage[]; activePageId: string; onSelect: (page: SitePage) => void; onAdd: () => void; onMove: (pageId: string, offset: number) => void; onDelete: (pageId: string) => void;
}) {
  return <><h2 className="panel-title">Pages du site</h2><p className="panel-subtitle">Votre menu de navigation est généré depuis ces pages.</p>
    {pages.map((page, index) => <div className="page-row" key={page.id}>
      <button className={`page-select ${activePageId === page.id ? "selected" : ""}`} onClick={() => onSelect(page)}>☰　{page.title}</button>
      <button className="small-button" title="Monter" onClick={() => onMove(page.id, -1)} disabled={index === 0}>↑</button>
      <button className="small-button" title="Descendre" onClick={() => onMove(page.id, 1)} disabled={index === pages.length - 1}>↓</button>
      <button className="small-button" title="Supprimer" onClick={() => onDelete(page.id)}>×</button>
    </div>)}
    <button className="button" style={{ width: "100%", marginTop: 13 }} onClick={onAdd}>＋ Ajouter une page</button>
  </>;
}

function MediaPanel({ media, inputRef, onUpload, onChoose }: {
  media: Array<{ url: string; name: string }>; inputRef: React.RefObject<HTMLInputElement | null>; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onChoose: (url: string) => void;
}) {
  return <><h2 className="panel-title">Médias</h2><p className="panel-subtitle">Importez vos images JPG, PNG ou WebP (4,5 Mo max, stockées sur R2).</p>
    <button className="button primary" style={{ width: "100%" }} onClick={() => inputRef.current?.click()}>＋ Importer une image</button>
    <label className="panel-label">Bibliothèque de médias</label>
    {media.length === 0 ? <div className="notice">Vos images importées apparaîtront ici. Les modèles utilisent des images de démonstration — remplacez-les par vos propres œuvres.</div>
      : media.map((item) => <button key={item.url} className="template-card" style={{ width: "100%", textAlign: "left", padding: 0 }} onClick={() => onChoose(item.url)}>
        <img src={item.url} alt={item.name} style={{ width: "100%", height: 110, objectFit: "cover" }} /><span style={{ display: "block", padding: 8, fontSize: 11 }}>{item.name} · Ajouter à la sélection</span>
      </button>)}
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onUpload} />
  </>;
}

function ThemePanel({ theme, onChange }: { theme: Theme; onChange: (path: "colors" | "typography" | "buttons", key: string, value: string | number) => void }) {
  const colors = [{ key: "primary", label: "Primaire" }, { key: "secondary", label: "Secondaire" }, { key: "background", label: "Fond" }, { key: "text", label: "Texte" }, { key: "accent", label: "Accent" }] as const;
  return <><h2 className="panel-title">Thème du site</h2><p className="panel-subtitle">Les choix s'appliquent à toutes les pages en temps réel.</p>
    <label className="panel-label">Couleurs</label>
    {colors.map(({ key, label }) => <div className="swatch-row" key={key}><input aria-label={`Couleur ${label}`} type="color" value={theme.colors[key]} onChange={(event) => onChange("colors", key, event.target.value)} /><span style={{ flex: 1 }}>{label}</span><code style={{ fontSize: 10, color: "#8a847b" }}>{theme.colors[key]}</code></div>)}
    <label className="panel-label">Boutons</label>
    <select className="field" value={theme.buttons.style} onChange={(event) => onChange("buttons", "style", event.target.value)}><option value="plein">Primaire plein</option><option value="contour">Contour</option></select>
    <label className="panel-label">Arrondi · {theme.buttons.radius}px</label>
    <input className="field" type="range" min="0" max="24" value={theme.buttons.radius} onChange={(event) => onChange("buttons", "radius", Number(event.target.value))} />
    <label className="panel-label">Typographie</label>
    <label style={{ display: "block", fontSize: 11, margin: "9px 0 5px" }}>Titres</label>
    <select className="field" value={theme.typography.headingFont} onChange={(event) => onChange("typography", "headingFont", event.target.value)}><option>Georgia</option><option>Arial</option><option>Verdana</option><option>Trebuchet MS</option></select>
    <label style={{ display: "block", fontSize: 11, margin: "9px 0 5px" }}>Corps de texte</label>
    <select className="field" value={theme.typography.bodyFont} onChange={(event) => onChange("typography", "bodyFont", event.target.value)}><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option></select>
    {[["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["body", "Corps"]].map(([key, label]) => <div className="swatch-row" key={key}><span style={{ flex: 1 }}>{label} · {theme.typography[key as keyof Theme["typography"]]}px</span><input aria-label={`Taille ${label}`} type="range" min={key === "body" ? 12 : 18} max={key === "body" ? 24 : key === "h1" ? 80 : 56} value={theme.typography[key as keyof Theme["typography"]]} onChange={(event) => onChange("typography", key, Number(event.target.value))} /></div>)}
    <div className="notice">Les variables du thème sont appliquées globalement à l'aperçu et au site publié.</div>
  </>;
}

function BlockProperties({ block, section, page, onBlockChange, onSectionRename, onPageChange }: {
  block: Block; section: Section; page: SitePage; onBlockChange: (blockId: string, field: string, value: string) => void; onSectionRename: (title: string) => void; onPageChange: (patch: Partial<SitePage>) => void;
}) {
  return <div>
    <label className="panel-label">Section sélectionnée</label>
    <input className="field" value={section.title} aria-label="Nom de section" onChange={(event) => onSectionRename(event.target.value)} />
    <label className="panel-label">Contenu</label>
    <label style={{ display: "block", fontSize: 11, marginBottom: 5 }}>Titre</label>
    <textarea className="field field-textarea" value={String(block.content.heading ?? "")} onChange={(event) => onBlockChange(block.id, "heading", event.target.value)} />
    <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>Texte</label>
    <textarea className="field field-textarea" value={String(block.content.body ?? "")} onChange={(event) => onBlockChange(block.id, "body", event.target.value)} />
    <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>Texte du bouton</label>
    <input className="field" value={String(block.content.action ?? "")} onChange={(event) => onBlockChange(block.id, "action", event.target.value)} />
    <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>URL de l'image</label>
    <input className="field" value={String(block.content.image ?? "")} placeholder="https://…" onChange={(event) => onBlockChange(block.id, "image", event.target.value)} />
    {block.type === "gallery" && <>
      <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>Catégories des œuvres</label>
      <input className="field" aria-label="Catégories des œuvres" value={Array.isArray(block.content.categories) ? block.content.categories.join(", ") : String(block.content.categories ?? "")} placeholder="Peinture, Dessin, Sculpture" onChange={(event) => onBlockChange(block.id, "categories", event.target.value)} />
      <small style={{ display: "block", marginTop: 4, color: "#817b72", fontSize: 10 }}>Une catégorie par œuvre, dans le même ordre que la galerie.</small>
    </>}
    {block.type === "contact" && <>
      <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>E-mail de contact</label>
      <input className="field" type="email" aria-label="E-mail de contact" value={String(block.content.email ?? "")} placeholder="bonjour@exemple.fr" onChange={(event) => onBlockChange(block.id, "email", event.target.value)} />
    </>}
    <label className="panel-label">Référencement de la page</label>
    <label style={{ display: "block", fontSize: 11, marginBottom: 5 }}>Nom de la page</label>
    <input className="field" value={page.title} onChange={(event) => onPageChange({ title: event.target.value, slug: slugify(event.target.value) || page.slug })} />
    <label style={{ display: "block", fontSize: 11, marginBottom: 5 }}>Titre SEO</label>
    <input className="field" value={page.seoTitle} onChange={(event) => onPageChange({ seoTitle: event.target.value })} />
    <label style={{ display: "block", fontSize: 11, margin: "12px 0 5px" }}>Description</label>
    <textarea className="field field-textarea" value={page.seoDescription} onChange={(event) => onPageChange({ seoDescription: event.target.value })} />
  </div>;
}

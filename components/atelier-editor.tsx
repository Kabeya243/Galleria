// Atelier editor hosted inside SANAA — the Atelier Kiggundu Fabric.js
// editor (public/atelier/editor.js, local Fabric.js bundle) rendered
// with the SANAA theme, owner-only, with the user's own artworks
// available as images ("Mes œuvres" tab). The editor script is vanilla
// JS: this component renders its DOM (same ids as Atelier's editor.html),
// loads the scripts in order, then calls window.AtelierEditor.init().
// All errors are shown inline, never window.alert.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import "./atelier-editor.css";

type ArtworkRef = { id: string; title: string; imageUrl: string };
type SavedDesign = { id: string; name: string; updatedAt: string | null; thumbnail: string | null };

declare global {
  interface Window {
    EDITOR_CONFIG?: { projectId: string; templateId: string; artworks: ArtworkRef[] };
    AtelierEditor?: { init: () => void; destroy: () => void };
    fabric?: unknown;
  }
}

export default function AtelierEditor({ artworks }: { artworks: ArtworkRef[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const templateId = searchParams.get("template") ?? "";

  const [fabricReady, setFabricReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [designsError, setDesignsError] = useState<string | null>(null);
  const [barMsg, setBarMsg] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState<string | null>(null);
  const initedRef = useRef(false);

  const refreshDesigns = useCallback(async () => {
    setDesignsLoading(true);
    setDesignsError(null);
    try {
      const res = await fetch("/api/atelier/projects");
      if (!res.ok) throw new Error("Impossible de charger vos designs.");
      setDesigns((await res.json()) as SavedDesign[]);
    } catch (err) {
      setDesignsError(err instanceof Error ? err.message : "Impossible de charger vos designs.");
    } finally {
      setDesignsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDesigns();
  }, [refreshDesigns]);

  // The editor script reads this at init.
  useEffect(() => {
    window.EDITOR_CONFIG = { projectId, templateId, artworks };
  }, [projectId, templateId, artworks]);

  useEffect(() => {
    if (!fabricReady || !editorReady || initedRef.current) return;
    if (typeof window.AtelierEditor?.init !== "function") {
      setScriptError("L’éditeur n’a pas pu démarrer (script introuvable).");
      return;
    }
    window.EDITOR_CONFIG = { projectId, templateId, artworks };
    initedRef.current = true;
    window.AtelierEditor.init();
  }, [fabricReady, editorReady, projectId, templateId, artworks]);

  useEffect(
    () => () => {
      window.AtelierEditor?.destroy();
      initedRef.current = false;
    },
    [],
  );

  const openDesign = (id: string) => {
    router.push(`/tools/portfolio-pdf?project=${encodeURIComponent(id)}`);
  };

  const duplicateDesign = async (id: string) => {
    setBarMsg(null);
    try {
      const res = await fetch(`/api/atelier/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      if (!res.ok) throw new Error("Impossible de dupliquer ce design.");
      setBarMsg("Copie créée.");
      await refreshDesigns();
    } catch (err) {
      setBarMsg(err instanceof Error ? err.message : "Impossible de dupliquer ce design.");
    }
  };

  const deleteDesign = async (id: string) => {
    if (armDelete !== id) {
      setArmDelete(id);
      window.setTimeout(() => setArmDelete((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setArmDelete(null);
    setBarMsg(null);
    try {
      const res = await fetch(`/api/atelier/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Impossible de supprimer ce design.");
      setBarMsg("Design supprimé.");
      if (projectId === id) router.push("/tools/portfolio-pdf");
      await refreshDesigns();
    } catch (err) {
      setBarMsg(err instanceof Error ? err.message : "Impossible de supprimer ce design.");
    }
  };

  return (
    <div className="atelier-scope">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      <Script src="/vendor/fabric.min.js" strategy="afterInteractive" onLoad={() => setFabricReady(true)} onError={() => setScriptError("Fabric.js n’a pas pu être chargé.")} />
      <Script src="/atelier/editor.js" strategy="afterInteractive" onLoad={() => setEditorReady(true)} onError={() => setScriptError("Le script de l’éditeur n’a pas pu être chargé.")} />

      <div className="atelier-projects-bar">
        <h2>Mes designs</h2>
        {designsLoading ? (
          <p className="atelier-projects-note">Chargement…</p>
        ) : designsError ? (
          <p className="atelier-projects-note">{designsError}</p>
        ) : designs.length === 0 ? (
          <p className="atelier-projects-note">Aucun design enregistré — ouvrez un modèle ci-dessous, puis Enregistrer.</p>
        ) : (
          designs.map((d) => (
            <span key={d.id} className="atelier-project-chip" role="group" aria-label={d.name}>
              <button type="button" onClick={() => openDesign(d.id)} style={{ display: "contents" }} title={`Ouvrir ${d.name}`}>
                {d.thumbnail ? <img src={d.thumbnail} alt="" /> : null}
                <span>
                  {d.name}
                  {d.updatedAt ? <small>{new Date(d.updatedAt).toLocaleDateString("fr-FR")}</small> : null}
                </span>
              </button>
              <button type="button" onClick={() => void duplicateDesign(d.id)} title="Dupliquer" aria-label={`Dupliquer ${d.name}`}>
                ⧉
              </button>
              <button
                type="button"
                className="atelier-danger"
                onClick={() => void deleteDesign(d.id)}
                title={armDelete === d.id ? "Cliquez à nouveau pour confirmer" : "Supprimer"}
                aria-label={`Supprimer ${d.name}`}
              >
                {armDelete === d.id ? "Confirmer ?" : "×"}
              </button>
            </span>
          ))
        )}
      </div>
      {barMsg ? <p className="atelier-projects-note" role="status">{barMsg}</p> : null}
      {scriptError ? <p className="atelier-error" role="alert">{scriptError}</p> : null}

      <div className="editor-shell">
        <header className="editor-topbar">
          <a className="editor-brand" href="/tools" title="Retour aux outils">
            <span className="brand-mark">S.</span>SANAA
          </a>
          <div className="top-divider" />
          <div className="project-title-wrap">
            <input id="project-name" defaultValue="Design sans titre" aria-label="Nom du projet" />
            <span id="save-status">Modifications non enregistrées</span>
          </div>
          <div className="top-actions">
            <button className="icon-button" id="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler">↶</button>
            <button className="icon-button" id="redo" title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↷</button>
            <span className="top-divider" />
            <button className="icon-button" id="zoom-out" title="Réduire">−</button>
            <span className="zoom-label" id="zoom-label">100%</span>
            <button className="icon-button" id="zoom-in" title="Agrandir">+</button>
            <button className="zoom-fit" id="zoom-fit">Ajuster</button>
            <span className="dimensions" id="dimensions" />
            <button className="button button-save" id="save-project">Enregistrer</button>
            <div className="export-wrap">
              <button className="button button-dark" id="export-button">Exporter <span>⌄</span></button>
              <div className="export-menu" id="export-menu">
                <button data-format="pdf">PDF haute qualité <small>Vectoriel · multi-pages</small></button>
                <button data-format="jpg">Image JPG <small>300 DPI · impression</small></button>
                <button data-format="png">Image PNG <small>Fond transparent possible</small></button>
              </div>
            </div>
          </div>
        </header>
        <main className="editor-layout">
          <aside className="left-rail">
            <button className="tool-tab active" data-tab="templates"><span>▧</span>Modèles</button>
            <button className="tool-tab" data-tab="elements"><span>◈</span>Éléments</button>
            <button className="tool-tab" data-tab="text"><span>T</span>Texte</button>
            <button className="tool-tab" data-tab="photos"><span>▧</span>Photos</button>
            <button className="tool-tab" data-tab="uploads"><span>↑</span>Importer</button>
            <button className="tool-tab" data-tab="artworks"><span>▦</span>Œuvres</button>
            <button className="tool-tab" data-tab="background"><span>◒</span>Fond</button>
            <div className="rail-bottom"><button className="tool-tab" id="add-page"><span>⊞</span>Page +</button></div>
          </aside>
          <aside className="left-panel" id="left-panel">
            <div className="panel-heading">
              <div><p className="eyebrow" id="panel-kicker">COMMENCER</p><h2 id="panel-title">Modèles</h2></div>
              <button id="panel-close" className="icon-button" title="Fermer">×</button>
            </div>
            <div id="panel-content" className="panel-content" />
          </aside>
          <section className="workspace" id="workspace">
            <div className="workspace-toolbar">
              <button id="grid-toggle" className="subtle-button">▦ Grille</button>
              <button id="safe-toggle" className="subtle-button">□ Marges</button>
              <span className="workspace-hint">Glissez pour déplacer · Maj-clic pour sélectionner plusieurs</span>
            </div>
            <div className="canvas-viewport" id="canvas-viewport">
              <div className="canvas-wrap" id="canvas-wrap">
                <canvas id="design-canvas" />
                <div className="safe-margin" id="safe-margin" />
                <div className="grid-overlay" id="grid-overlay" />
              </div>
            </div>
            <div className="pages-bar">
              <button id="prev-page" className="icon-button" title="Page précédente">‹</button>
              <div id="page-list" className="page-list" />
              <button id="duplicate-page" className="icon-button" title="Dupliquer la page">⧉</button>
              <button id="rename-page" className="icon-button" title="Renommer la page">✎</button>
              <button id="move-page-left" className="icon-button" title="Déplacer la page à gauche">←</button>
              <button id="move-page-right" className="icon-button" title="Déplacer la page à droite">→</button>
              <button id="delete-page" className="icon-button" title="Supprimer la page">×</button>
              <button id="next-page" className="icon-button" title="Page suivante">›</button>
            </div>
          </section>
          <aside className="properties-panel">
            <div className="properties-heading">
              <div><p className="eyebrow">PERSONNALISER</p><h2 id="properties-title">Page</h2></div>
              <span className="selection-dot" />
            </div>
            <div id="properties-content" className="properties-content" />
            <div id="layers-section" className="layers-section" />
          </aside>
        </main>
      </div>
      <input type="file" id="file-input" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" hidden />
      <div id="toast" className="toast" role="status" aria-live="polite" />
    </div>
  );
}

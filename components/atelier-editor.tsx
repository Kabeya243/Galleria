// Atelier editor hosted inside SANAA — the Atelier Kiggundu Fabric.js
// editor (public/atelier/editor.js, local Fabric.js bundle) rendered
// with the SANAA theme, owner-only, with the user's own artworks
// available as images ("Mes œuvres" tab). The editor script is vanilla
// JS: this component renders its DOM (same ids as Atelier's editor.html),
// loads the scripts in order, then calls window.AtelierEditor.init().
// All errors are shown inline, never window.alert.
// `standalone` renders the editor as its own full-viewport page
// (no platform shell): the editor shell fills the whole viewport,
// edge to edge, with no bar above it. Saved designs live in the
// editor's own "Designs" tab (left rail, rendered by editor.js),
// not in a bar above the editor.

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import "./atelier-editor.css";

type ArtworkRef = { id: string; title: string; imageUrl: string };

declare global {
  interface Window {
    EDITOR_CONFIG?: { projectId: string; templateId: string; artworks: ArtworkRef[] };
    AtelierEditor?: { init: () => void; destroy: () => void };
    fabric?: unknown;
  }
}

export default function AtelierEditor({ artworks, standalone }: { artworks: ArtworkRef[]; standalone?: boolean }) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const templateId = searchParams.get("template") ?? "";

  const [fabricReady, setFabricReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const initedRef = useRef(false);

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

  return (
    <div className={standalone ? "atelier-scope atelier-standalone" : "atelier-scope"}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      <Script src="/vendor/fabric.min.js" strategy="afterInteractive" onLoad={() => setFabricReady(true)} onError={() => setScriptError("Fabric.js n’a pas pu être chargé.")} />
      <Script src="/atelier/editor.js" strategy="afterInteractive" onLoad={() => setEditorReady(true)} onError={() => setScriptError("Le script de l’éditeur n’a pas pu être chargé.")} />

      {scriptError ? <p className="atelier-error" role="alert">{scriptError}</p> : null}

      <div className="editor-shell">
        <header className="editor-topbar">
          <a className="editor-brand" href="/" title="Retour à l'accueil">
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
            <button className="tool-tab" data-tab="designs"><span>▤</span>Designs</button>
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

// Atelier home (Canva-like): the first screen of the portfolio builder.
// Shows the user's saved designs and the templates, then the editor opens
// from a card (or from "Creer un design" for a blank page). Designs and
// templates are fetched client-side from the Atelier APIs — nothing is
// hard-coded, so the list always matches what the editor itself sees.

"use client";

import { useEffect, useMemo, useState } from "react";
import "./atelier-home.css";

type AtelierDesign = {
  id: string;
  name: string;
  updatedAt?: string;
  thumbnail?: string | null;
};

type AtelierTemplateObject = {
  type?: string;
  text?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  fontSize?: number;
  fill?: string | null;
  fontFamily?: string;
  fontWeight?: string | number;
  stroke?: string | null;
  strokeWidth?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
};

type AtelierTemplate = {
  id: string;
  name: string;
  category?: string;
  pages?: { width: number; height: number; background?: string; objects?: AtelierTemplateObject[] }[];
};

// Retour a la ligne d'un texte a la largeur de sa zone (comme Fabric le
// fait dans l'editeur) : sans cela, le SVG affiche le texte sur une seule
// ligne qui depasse de la miniature.
function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const charWidth = fontSize * 0.52;
  const lines: string[] = [];
  for (const rawLine of String(text || "").split("\n")) {
    let line = "";
    for (const word of rawLine.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length * charWidth <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Miniature fidele d'un modele : les objets du modele dessines en SVG a
// l'echelle (viewBox = dimensions de la page). Les formes et les textes
// sont les vrais objets du modele, pas une image d'illustration.
function TemplateThumb({ template }: { template: AtelierTemplate }) {
  const page = template.pages?.[0];
  if (!page) return <div className="atelier-home-thumb-empty" aria-hidden="true" />;
  const w = page.width || 1080;
  const h = page.height || 1080;
  const objects = (page.objects || []).slice(0, 10);
  const fillOf = (value: string | null | undefined) =>
    typeof value === "string" && value ? value : "#cccccc";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="atelier-home-thumb-svg"
      role="img"
      aria-label={template.name}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={w} height={h} fill={page.background || "#ffffff"} />
      {objects.map((object, index) => {
        const left = object.left || 0;
        const top = object.top || 0;
        const width = object.width || 0;
        const height = object.height || 0;
        if (object.type === "rect") {
          return (
            <rect
              key={index}
              x={left}
              y={top}
              width={width}
              height={height}
              rx={object.rx || 0}
              ry={object.ry || 0}
              fill={fillOf(object.fill)}
            />
          );
        }
        if (object.type === "circle") {
          const rx = object.rx || width / 2;
          const ry = object.ry || height / 2;
          return (
            <ellipse
              key={index}
              cx={left + rx}
              cy={top + ry}
              rx={rx}
              ry={ry}
              fill={fillOf(object.fill)}
            />
          );
        }
        if (object.type === "triangle") {
          return (
            <polygon
              key={index}
              points={`${left + width / 2},${top} ${left + width},${top + height} ${left},${top + height}`}
              fill={fillOf(object.fill)}
            />
          );
        }
        if (object.type === "line") {
          return (
            <line
              key={index}
              x1={left + (object.x1 || 0)}
              y1={top + (object.y1 || 0)}
              x2={left + (object.x2 || width)}
              y2={top + (object.y2 || 0)}
              stroke={fillOf(object.stroke)}
              strokeWidth={object.strokeWidth || 2}
            />
          );
        }
        if (object.type === "textbox" || object.type === "i-text" || object.type === "text") {
          const fontSize = object.fontSize || 32;
          const lines = wrapText(object.text || "", fontSize, object.width || w);
          return (
            <text
              key={index}
              x={left}
              y={top + fontSize}
              fontSize={fontSize}
              fill={fillOf(object.fill)}
              fontFamily={object.fontFamily || "Manrope, sans-serif"}
              fontWeight={object.fontWeight || "normal"}
            >
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={left} dy={lineIndex === 0 ? 0 : fontSize * 1.2}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        }
        if ((object.type === "polygon" || object.type === "star" || object.type === "arrow") && object.points?.length) {
          const points = object.points
            .map((point) => `${left + width / 2 + point.x},${top + height / 2 + point.y}`)
            .join(" ");
          return <polygon key={index} points={points} fill={fillOf(object.fill)} />;
        }
        return null;
      })}
    </svg>
  );
}

export default function AtelierHome() {
  const [designs, setDesigns] = useState<AtelierDesign[] | null>(null);
  const [templates, setTemplates] = useState<AtelierTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [designsResponse, templatesResponse] = await Promise.all([
          fetch("/api/atelier/projects"),
          fetch("/api/atelier/templates"),
        ]);
        if (!designsResponse.ok) throw new Error("Impossible de charger vos designs.");
        if (!templatesResponse.ok) throw new Error("Impossible de charger les modèles.");
        const [designsData, templatesData] = await Promise.all([
          designsResponse.json(),
          templatesResponse.json(),
        ]);
        if (cancelled) return;
        setDesigns(Array.isArray(designsData) ? designsData : []);
        setTemplates(Array.isArray(templatesData) ? templatesData : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chargement impossible.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const visibleDesigns = useMemo(
    () => (designs || []).filter((design) => !needle || design.name.toLowerCase().includes(needle)),
    [designs, needle],
  );
  const visibleTemplates = useMemo(
    () =>
      (templates || []).filter(
        (template) =>
          !needle ||
          template.name.toLowerCase().includes(needle) ||
          (template.category || "").toLowerCase().includes(needle),
      ),
    [templates, needle],
  );

  const formatDate = (value?: string) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="atelier-home-scope">
      <div className="atelier-home">
        <header className="atelier-home-hero">
          <p className="atelier-home-eyebrow">Atelier</p>
          <h1>Créez vos designs</h1>
          <p className="atelier-home-subtitle">
            Ouvrez un design pour le modifier, ou partez d&apos;un modèle.
          </p>
          <div className="atelier-home-actions">
            <a className="atelier-home-create" href="/tools/portfolio-pdf?new=1">
              ＋ Créer un design
            </a>
            <input
              className="atelier-home-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un design ou un modèle…"
              aria-label="Rechercher un design ou un modèle"
            />
          </div>
        </header>

        {error ? (
          <p className="atelier-home-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => window.location.reload()}>
              Réessayer
            </button>
          </p>
        ) : null}

        <section className="atelier-home-section" aria-labelledby="atelier-home-designs-title">
          <h2 id="atelier-home-designs-title">Vos designs</h2>
          {designs === null ? (
            <p className="atelier-home-muted">Chargement de vos designs…</p>
          ) : visibleDesigns.length === 0 ? (
            <p className="atelier-home-muted">
              {needle
                ? "Aucun design ne correspond à cette recherche."
                : "Aucun design pour l'instant — créez votre premier design ci-dessus."}
            </p>
          ) : (
            <div className="atelier-home-grid">
              {visibleDesigns.map((design) => (
                <a
                  key={design.id}
                  className="atelier-home-card"
                  href={`/tools/portfolio-pdf?project=${encodeURIComponent(design.id)}`}
                >
                  <span className="atelier-home-thumb">
                    {design.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={design.thumbnail} alt="" />
                    ) : (
                      <span className="atelier-home-thumb-letter" aria-hidden="true">
                        {(design.name || "D").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="atelier-home-card-name">{design.name || "Design sans titre"}</span>
                  {formatDate(design.updatedAt) ? (
                    <span className="atelier-home-card-meta">Modifié le {formatDate(design.updatedAt)}</span>
                  ) : null}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="atelier-home-section" aria-labelledby="atelier-home-templates-title">
          <h2 id="atelier-home-templates-title">Modèles</h2>
          {templates === null ? (
            <p className="atelier-home-muted">Chargement des modèles…</p>
          ) : visibleTemplates.length === 0 ? (
            <p className="atelier-home-muted">Aucun modèle ne correspond à cette recherche.</p>
          ) : (
            <div className="atelier-home-grid">
              {visibleTemplates.map((template) => {
                const page = template.pages?.[0];
                return (
                  <a
                    key={template.id}
                    className="atelier-home-card"
                    href={`/tools/portfolio-pdf?template=${encodeURIComponent(template.id)}`}
                  >
                    <span
                      className="atelier-home-thumb"
                      style={page ? { aspectRatio: `${page.width || 1080} / ${page.height || 1080}` } : undefined}
                    >
                      <TemplateThumb template={template} />
                    </span>
                    <span className="atelier-home-card-name">{template.name}</span>
                    <span className="atelier-home-card-meta">
                      {template.category || ""}
                      {template.category && page ? " · " : ""}
                      {page ? `${page.width} × ${page.height} px` : ""}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

// LEGACY renderer — read-only since 8 Nov 2026. The simple website
// builder editor (components/website-builder.tsx) was removed on
// Kabeya's decision (keep only the advanced builder), so no new sites
// can be created with these 51 themes. This file and lib/site-templates.ts
// are KEPT deliberately: sites already published with the old builder
// live as SavedWork rows of kind "website" and are still served at
// /sites/[id] by app/sites/[id]/page.tsx — deleting this renderer would
// break those published pages. Do not add features here; new sites are
// built with the advanced builder (components/advanced-site-editor.tsx).
//
// Shared artist-site model + renderer. Used by the public shareable page
// (app/sites/[id]/page.tsx), so what visitors see is exactly what the
// old editor showed. One source of truth, no drift.
//
// Themes are real: each one changes background, ink, accent, heading font,
// body font and layout (hero alignment, hero style, gallery columns,
// image radius, rules). The template registry lives in
// lib/site-templates.ts (50+ original templates, data-driven).

import { ArrowUp, Globe, Instagram, Mail, Menu, Twitter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SITE_THEMES, siteTemplateById, type SiteTheme, type SiteThemeId } from "@/lib/site-templates";

export type { SiteTheme, SiteThemeId };
export { SITE_THEMES };
export const themeById = siteTemplateById;

export type CvEntry = { role: string; organisation: string; year: string };
export type PressItem = { title: string; source: string; year: string; url: string };

export type SiteConfig = {
  siteTitle: string;
  siteDescription: string;
  artistName: string;
  tagline: string;
  bio: string;
  theme: SiteThemeId;
  accentColor: string;
  heroArtworkId: string;
  heroHeading: string;
  heroSubheading: string;
  showHero: boolean;
  showGalleries: boolean;
  showBio: boolean;
  showCv: boolean;
  showExhibitions: boolean;
  showPress: boolean;
  showContact: boolean;
  selectedExhibitionIds: string[];
  cv: CvEntry[];
  press: PressItem[];
  email: string;
  website: string;
  instagram: string;
  twitter: string;
};

export type SiteArtwork = {
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

export type SiteExhibition = {
  id: string;
  title: string;
  description: string;
  status: string;
  artworks: SiteArtwork[];
};

export function defaultSiteConfig(artistName: string, email: string, exhibitions: SiteExhibition[]): SiteConfig {
  return {
    siteTitle: `${artistName} — Artist`,
    siteDescription: `Portfolio of ${artistName}, contemporary artist.`,
    artistName,
    tagline: "Contemporary artist",
    bio: "",
    theme: "gallery-white",
    accentColor: "#000000",
    heroArtworkId: exhibitions.flatMap((e) => e.artworks)[0]?.id ?? "",
    heroHeading: artistName,
    heroSubheading: "Contemporary artist",
    showHero: true,
    showGalleries: true,
    showBio: true,
    showCv: true,
    showExhibitions: true,
    showPress: true,
    showContact: true,
    selectedExhibitionIds: exhibitions.map((e) => e.id),
    cv: [],
    press: [],
    email,
    website: "",
    instagram: "",
    twitter: "",
  };
}

export function siteConfigFromSaved(data: Record<string, unknown>, artistName: string, email: string, exhibitions: SiteExhibition[]): SiteConfig {
  const base = defaultSiteConfig(artistName, email, exhibitions);
  const merged: SiteConfig = { ...base, ...(data as Partial<SiteConfig>) };
  if (!Array.isArray(merged.cv)) merged.cv = [];
  if (!Array.isArray(merged.press)) merged.press = [];
  if (!Array.isArray(merged.selectedExhibitionIds)) merged.selectedExhibitionIds = base.selectedExhibitionIds;
  merged.cv = merged.cv.filter((c) => c && typeof c === "object");
  merged.press = merged.press.filter((p) => p && typeof p === "object");
  return merged;
}

function headingStyle(theme: SiteTheme): React.CSSProperties {
  return {
    fontFamily: theme.headingFont,
    textTransform: theme.uppercaseHeadings ? ("uppercase" as const) : undefined,
    letterSpacing: theme.uppercaseHeadings ? "0.08em" : undefined,
    overflowWrap: "break-word",
  };
}

/** Pure, dependency-free renderer for an artist site. `maxWidth` drives the
 * responsive preview (desktop / tablet / mobile) in the builder. */
export default function SitePreview({
  config,
  exhibitions,
  maxWidth,
}: {
  config: SiteConfig;
  exhibitions: SiteExhibition[];
  maxWidth?: number;
}) {
  const theme = themeById(config.theme);
  const accent = config.accentColor || "#000000";
  const allArtworks = exhibitions.flatMap((e) => e.artworks);
  const heroArt = allArtworks.find((a) => a.id === config.heroArtworkId) ?? allArtworks[0];
  const shownExhibitions = exhibitions.filter((e) => config.selectedExhibitionIds.includes(e.id));

  // Compact layout: driven by the builder preview width when set, by the
  // real viewport on the public page (no maxWidth there).
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewportNarrow, setViewportNarrow] = useState(false);
  const [viewportXSmall, setViewportXSmall] = useState(false);
  useEffect(() => {
    if (maxWidth !== undefined) return;
    const narrow = window.matchMedia("(max-width: 768px)");
    const xsmall = window.matchMedia("(max-width: 480px)");
    const sync = () => { setViewportNarrow(narrow.matches); setViewportXSmall(xsmall.matches); };
    sync();
    narrow.addEventListener("change", sync);
    xsmall.addEventListener("change", sync);
    return () => { narrow.removeEventListener("change", sync); xsmall.removeEventListener("change", sync); };
  }, [maxWidth]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  const compact = maxWidth !== undefined ? maxWidth <= 768 : viewportNarrow;
  const xsmall = maxWidth !== undefined ? maxWidth <= 480 : viewportXSmall;
  const galleryCols = compact ? (xsmall ? 1 : 2) : theme.galleryCols;
  const navLinks = [
    ...(config.showGalleries && shownExhibitions.length > 0 ? [{ href: "#works", label: "Works" }] : []),
    ...(config.showBio || config.showCv ? [{ href: "#about", label: "About" }] : []),
    ...(config.showContact ? [{ href: "#contact", label: "Contact" }] : []),
  ];

  const wrap: React.CSSProperties = {
    background: theme.bg,
    color: theme.ink,
    fontFamily: theme.bodyFont,
    width: "100%",
    maxWidth: maxWidth ?? 1100,
    margin: "0 auto",
    border: `1px solid ${theme.line}`,
    overflow: "hidden",
    textAlign: "left",
  };

  return (
    <div style={wrap} id="top">
      {/* Top bar: brand + real anchor nav, burger menu when compact. */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px 16px",
          padding: "18px 28px",
          borderBottom: `1px solid ${theme.line}`,
        }}
      >
        <a href="#top" style={{ ...headingStyle(theme), fontSize: 20, fontWeight: 600, color: theme.ink, textDecoration: "none" }}>
          {config.artistName || "Artist"}
        </a>
        {navLinks.length > 0 && (compact ? (
          <>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="site-preview-nav"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((value) => !value)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, border: `1px solid ${theme.line}`, borderRadius: 6, background: "transparent", color: theme.ink, cursor: "pointer" }}
            >
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
            {menuOpen && (
              <nav id="site-preview-nav" aria-label="Navigation du site" style={{ display: "flex", flexDirection: "column", width: "100%", gap: 2, padding: "6px 0 2px" }}>
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ padding: "10px 4px", fontSize: 14, color: theme.ink, textDecoration: "none" }}>{link.label}</a>
                ))}
              </nav>
            )}
          </>
        ) : (
          <nav aria-label="Navigation du site" style={{ display: "flex", gap: 22 }}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.muted, textDecoration: "none" }}>{link.label}</a>
            ))}
          </nav>
        ))}
      </header>

      {/* Hero — layout driven by the template's heroStyle: classic
          (heading, then image), split (text left, image right) or banner
          (full-bleed image first, heading below). Images take the
          template's corner radius. */}
      {config.showHero && (
        <div style={{ padding: "56px 28px 48px", textAlign: theme.heroAlign }}>
          {theme.heroStyle === "banner" && heroArt && (
            <div style={{ margin: "-56px -28px 32px" }}>
              {heroArt.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroArt.imageUrl} alt={heroArt.title} style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: 300, background: `linear-gradient(135deg, ${heroArt.color}, ${heroArt.accent})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 18, fontFamily: theme.headingFont }}>
                  {heroArt.title}
                </div>
              )}
            </div>
          )}
          {theme.heroStyle === "split" ? (
            <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 28, alignItems: "center", textAlign: "left" }}>
              <div>
                <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, margin: "0 0 14px" }}>
                  {config.tagline || "Contemporary artist"}
                </p>
                <h1 style={{ ...headingStyle(theme), fontSize: compact ? 32 : 40, lineHeight: 1.05, margin: "0 0 14px", fontWeight: 600 }}>
                  {config.heroHeading || config.artistName}
                </h1>
                {config.heroSubheading && (
                  <p style={{ fontSize: 16, color: theme.muted, maxWidth: 560, margin: 0, lineHeight: 1.6 }}>
                    {config.heroSubheading}
                  </p>
                )}
              </div>
              {heroArt && (
                <div>
                  {heroArt.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroArt.imageUrl} alt={heroArt.title} style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block", borderRadius: theme.imageRadius }} />
                  ) : (
                    <div style={{ width: "100%", height: 300, background: `linear-gradient(135deg, ${heroArt.color}, ${heroArt.accent})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 18, fontFamily: theme.headingFont, borderRadius: theme.imageRadius }}>
                      {heroArt.title}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, margin: "0 0 14px" }}>
                {config.tagline || "Contemporary artist"}
              </p>
              <h1 style={{ ...headingStyle(theme), fontSize: compact ? 32 : 44, lineHeight: 1.05, margin: "0 0 14px", fontWeight: 600 }}>
                {config.heroHeading || config.artistName}
              </h1>
              {config.heroSubheading && (
                <p style={{ fontSize: 16, color: theme.muted, maxWidth: 560, margin: theme.heroAlign === "center" ? "0 auto" : "0", lineHeight: 1.6 }}>
                  {config.heroSubheading}
                </p>
              )}
              {heroArt && theme.heroStyle !== "banner" && (
                <div style={{ marginTop: 32 }}>
                  {heroArt.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroArt.imageUrl} alt={heroArt.title} style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block", borderRadius: theme.imageRadius }} />
                  ) : (
                    <div style={{ width: "100%", height: 320, background: `linear-gradient(135deg, ${heroArt.color}, ${heroArt.accent})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 18, fontFamily: theme.headingFont, borderRadius: theme.imageRadius }}>
                      {heroArt.title}
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>
                    {heroArt.title}{heroArt.year ? `, ${heroArt.year}` : ""}{heroArt.medium ? ` — ${heroArt.medium}` : ""}
                  </p>
                </div>
              )}
              {heroArt && theme.heroStyle === "banner" && (
                <p style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>
                  {heroArt.title}{heroArt.year ? `, ${heroArt.year}` : ""}{heroArt.medium ? ` — ${heroArt.medium}` : ""}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Galleries */}
      {config.showGalleries && shownExhibitions.length > 0 && (
        <div id="works" style={{ padding: "8px 28px 40px" }}>
          {shownExhibitions.map((ex, exIndex) => (
            <div key={ex.id} style={{ marginTop: 32 }}>
              <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "0 0 6px", fontWeight: 600 }}>{ex.title}</h2>
              {ex.description && <p style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>{ex.description}</p>}
              {ex.artworks.length === 0 ? (
                <p style={{ color: theme.muted, fontSize: 14 }}>No artworks in this exhibition yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${galleryCols}, 1fr)`, gap: 20 }}>
                  {ex.artworks.map((art, artIndex) => (
                    <figure key={art.id} style={{ margin: 0 }}>
                      {art.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art.imageUrl} alt={art.title} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", background: theme.surface, borderRadius: theme.imageRadius }} loading={exIndex === 0 && artIndex < galleryCols ? "eager" : "lazy"} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "4 / 3", background: `linear-gradient(135deg, ${art.color}, ${art.accent})`, borderRadius: theme.imageRadius }} />
                      )}
                      <figcaption style={{ paddingTop: 10 }}>
                        <div style={{ ...headingStyle(theme), fontSize: 15, fontWeight: 600 }}>{art.title}</div>
                        <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                          {[art.year, art.medium, art.dimensions].filter(Boolean).join(" · ")}
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bio + CV */}
      {(config.showBio || config.showCv) && (
        <div id="about" style={{ padding: "8px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
          {config.showBio && (
            <>
              <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "32px 0 12px", fontWeight: 600 }}>About</h2>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: theme.ink, maxWidth: 680, margin: 0, whiteSpace: "pre-wrap" }}>
                {config.bio || "Biography not written yet."}
              </p>
            </>
          )}
          {config.showCv && config.cv.length > 0 && (
            <>
              <h3 style={{ ...headingStyle(theme), fontSize: 18, margin: "32px 0 12px", fontWeight: 600 }}>CV — Selected</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {config.cv.map((entry, i) => (
                  <li key={i} style={{ display: "flex", gap: 16, padding: "10px 0", borderTop: `1px solid ${theme.line}`, fontSize: 14 }}>
                    <span style={{ color: theme.muted, minWidth: 56 }}>{entry.year}</span>
                    <span><strong>{entry.role}</strong>{entry.organisation ? ` — ${entry.organisation}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Exhibitions list */}
      {config.showExhibitions && shownExhibitions.length > 0 && (
        <div style={{ padding: "8px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
          <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "32px 0 12px", fontWeight: 600 }}>Exhibitions</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shownExhibitions.map((ex) => (
              <li key={ex.id} style={{ padding: "10px 0", borderTop: `1px solid ${theme.line}`, fontSize: 14 }}>
                <strong>{ex.title}</strong>
                <span style={{ color: theme.muted }}> — {ex.status === "public" ? "Public" : "In progress"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Press */}
      {config.showPress && config.press.length > 0 && (
        <div style={{ padding: "8px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
          <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "32px 0 12px", fontWeight: 600 }}>Press</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {config.press.map((item, i) => (
              <li key={i} style={{ padding: "10px 0", borderTop: `1px solid ${theme.line}`, fontSize: 14 }}>
                <strong>{item.title}</strong>
                <span style={{ color: theme.muted }}> — {item.source}{item.year ? `, ${item.year}` : ""}</span>
                {item.url && (
                  <span> · <a href={item.url} target="_blank" rel="noreferrer" style={{ color: accent }}>Read</a></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contact */}
      {config.showContact && (
        <div id="contact" style={{ padding: "32px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
          <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "0 0 12px", fontWeight: 600 }}>Contact</h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>
            {config.email && (<>Email — <a href={`mailto:${config.email}`} style={{ color: accent }}>{config.email}</a><br /></>)}
            {config.website && (<>Website — <a href={config.website} target="_blank" rel="noreferrer" style={{ color: accent }}>{config.website}</a><br /></>)}
            {config.instagram && (<>Instagram — <a href={`https://instagram.com/${config.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: accent }}>{config.instagram}</a><br /></>)}
            {config.twitter && (<>X / Twitter — <a href={`https://x.com/${config.twitter.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: accent }}>{config.twitter}</a></>)}
            {!config.email && !config.website && !config.instagram && !config.twitter && (
              <span style={{ color: theme.muted }}>No contact details added yet.</span>
            )}
          </p>
        </div>
      )}

      {/* Footer: brand, site nav, contact with icons, copyright, back to top. */}
      <footer style={{ padding: "36px 28px 28px", borderTop: `1px solid ${theme.line}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px 40px", justifyContent: "space-between" }}>
          <div>
            <div style={{ ...headingStyle(theme), fontSize: 18, fontWeight: 600 }}>{config.artistName || "Artist"}</div>
            <p style={{ fontSize: 13, color: theme.muted, margin: "8px 0 0", maxWidth: 320, lineHeight: 1.6 }}>
              {config.tagline || "Contemporary artist"}
            </p>
          </div>
          {navLinks.length > 0 && (
            <nav aria-label="Navigation du pied de page" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} style={{ fontSize: 13, color: theme.ink, textDecoration: "none" }}>{link.label}</a>
              ))}
            </nav>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {config.email && (
              <a href={`mailto:${config.email}`} style={{ color: theme.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Mail size={15} aria-hidden="true" />{config.email}
              </a>
            )}
            {config.website && (
              <a href={config.website} target="_blank" rel="noreferrer" style={{ color: theme.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Globe size={15} aria-hidden="true" />Website
              </a>
            )}
            {config.instagram && (
              <a href={`https://instagram.com/${config.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: theme.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Instagram size={15} aria-hidden="true" />{config.instagram}
              </a>
            )}
            {config.twitter && (
              <a href={`https://x.com/${config.twitter.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: theme.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Twitter size={15} aria-hidden="true" />{config.twitter}
              </a>
            )}
            {!config.email && !config.website && !config.instagram && !config.twitter && (
              <span style={{ color: theme.muted }}>No contact details added yet.</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 18, borderTop: `1px solid ${theme.line}`, fontSize: 12, color: theme.muted }}>
          <span>© {new Date().getFullYear()} {config.artistName || "Artist"}</span>
          <span>Built with SANAA — Artist Website Builder</span>
          <a href="#top" style={{ color: theme.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowUp size={14} aria-hidden="true" />Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}

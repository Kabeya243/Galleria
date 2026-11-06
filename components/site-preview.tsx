// Shared artist-site model + renderer. Used by the Website Builder's live
// preview (components/website-builder.tsx) and by the public shareable page
// (app/sites/[id]/page.tsx), so what the artist sees while editing is
// exactly what a visitor sees. One source of truth, no drift.
//
// Themes are real: each one changes background, ink, accent, heading font,
// body font and layout (hero alignment, gallery columns, rules).

export type SiteThemeId = "gallery-white" | "dark-editorial" | "minimal-mono";

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

export type SiteTheme = {
  id: SiteThemeId;
  label: string;
  blurb: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  headingFont: string;
  bodyFont: string;
  heroAlign: "center" | "left";
  galleryCols: number;
  uppercaseHeadings: boolean;
};

export const SITE_THEMES: SiteTheme[] = [
  {
    id: "gallery-white",
    label: "Gallery White",
    blurb: "The SANAA white-gallery look — warm paper, near-black ink, gold accent.",
    bg: "#fdfdfc",
    surface: "#ffffff",
    ink: "#141414",
    muted: "#6f6a61",
    line: "#e6e1d8",
    headingFont: "Fraunces, Georgia, serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    heroAlign: "center",
    galleryCols: 3,
    uppercaseHeadings: false,
  },
  {
    id: "dark-editorial",
    label: "Dark Editorial",
    blurb: "Ink-black pages, warm paper text — the work glows against the dark.",
    bg: "#141414",
    surface: "#1d1c1a",
    ink: "#f5f1e8",
    muted: "#a9a294",
    line: "#3a3835",
    headingFont: "Fraunces, Georgia, serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    heroAlign: "left",
    galleryCols: 2,
    uppercaseHeadings: false,
  },
  {
    id: "minimal-mono",
    label: "Minimal Mono",
    blurb: "Stark white, one ink, uppercase labels and hairline rules. Nothing extra.",
    bg: "#ffffff",
    surface: "#ffffff",
    ink: "#111111",
    muted: "#777777",
    line: "#dddddd",
    headingFont: "'DM Sans', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    heroAlign: "left",
    galleryCols: 1,
    uppercaseHeadings: true,
  },
];

export function themeById(id: string): SiteTheme {
  return SITE_THEMES.find((t) => t.id === id) ?? SITE_THEMES[0];
}

export function defaultSiteConfig(artistName: string, email: string, exhibitions: SiteExhibition[]): SiteConfig {
  return {
    siteTitle: `${artistName} — Artist`,
    siteDescription: `Portfolio of ${artistName}, contemporary artist.`,
    artistName,
    tagline: "Contemporary artist",
    bio: "",
    theme: "gallery-white",
    accentColor: "#a67c37",
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
  const accent = config.accentColor || "#a67c37";
  const allArtworks = exhibitions.flatMap((e) => e.artworks);
  const heroArt = allArtworks.find((a) => a.id === config.heroArtworkId) ?? allArtworks[0];
  const shownExhibitions = exhibitions.filter((e) => config.selectedExhibitionIds.includes(e.id));

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
    <div style={wrap}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 28px",
          borderBottom: `1px solid ${theme.line}`,
        }}
      >
        <span style={{ ...headingStyle(theme), fontSize: 20, fontWeight: 600 }}>
          {config.artistName || "Artist"}
        </span>
        <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.muted }}>
          {config.showGalleries ? "Works" : ""}{config.showBio ? " · About" : ""}{config.showContact ? " · Contact" : ""}
        </span>
      </div>

      {/* Hero */}
      {config.showHero && (
        <div style={{ padding: theme.heroAlign === "center" ? "56px 28px 48px" : "56px 28px 48px", textAlign: theme.heroAlign }}>
          <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, margin: "0 0 14px" }}>
            {config.tagline || "Contemporary artist"}
          </p>
          <h1 style={{ ...headingStyle(theme), fontSize: 44, lineHeight: 1.05, margin: "0 0 14px", fontWeight: 600 }}>
            {config.heroHeading || config.artistName}
          </h1>
          {config.heroSubheading && (
            <p style={{ fontSize: 16, color: theme.muted, maxWidth: 560, margin: theme.heroAlign === "center" ? "0 auto" : "0", lineHeight: 1.6 }}>
              {config.heroSubheading}
            </p>
          )}
          {heroArt && (
            <div style={{ marginTop: 32 }}>
              {heroArt.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroArt.imageUrl} alt={heroArt.title} style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: 320, background: `linear-gradient(135deg, ${heroArt.color}, ${heroArt.accent})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 18, fontFamily: theme.headingFont }}>
                  {heroArt.title}
                </div>
              )}
              <p style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>
                {heroArt.title}{heroArt.year ? `, ${heroArt.year}` : ""}{heroArt.medium ? ` — ${heroArt.medium}` : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Galleries */}
      {config.showGalleries && shownExhibitions.length > 0 && (
        <div style={{ padding: "8px 28px 40px" }}>
          {shownExhibitions.map((ex) => (
            <div key={ex.id} style={{ marginTop: 32 }}>
              <h2 style={{ ...headingStyle(theme), fontSize: 26, margin: "0 0 6px", fontWeight: 600 }}>{ex.title}</h2>
              {ex.description && <p style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>{ex.description}</p>}
              {ex.artworks.length === 0 ? (
                <p style={{ color: theme.muted, fontSize: 14 }}>No artworks in this exhibition yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${theme.galleryCols}, 1fr)`, gap: 20 }}>
                  {ex.artworks.map((art) => (
                    <figure key={art.id} style={{ margin: 0 }}>
                      {art.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art.imageUrl} alt={art.title} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", background: theme.surface }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "4 / 3", background: `linear-gradient(135deg, ${art.color}, ${art.accent})` }} />
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
        <div style={{ padding: "8px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
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
        <div style={{ padding: "32px 28px 40px", borderTop: `1px solid ${theme.line}` }}>
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
          <p style={{ fontSize: 12, color: theme.muted, marginTop: 28 }}>Built with SANAA — Artist Website Builder</p>
        </div>
      )}
    </div>
  );
}

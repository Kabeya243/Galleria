// Public view of a published advanced site (Claude « atelier-sites »,
// integrated 8 Nov 2026). Adapted from the standalone builder's
// src/app/sites/[slug]/site-view.tsx: Prisma client replaced by SANAA's
// db (lib/db), published.css imported once in app/layout.tsx instead of
// here, footer links back to SANAA. Only published sites render;
// getPublishedSite is also used by the /sites/[slug] route metadata.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Theme } from "@/lib/advanced-site-types";
import { ContactForm } from "@/components/advanced-site-contact-form";
import { GalleryLightbox } from "@/components/advanced-site-gallery-lightbox";

export async function getPublishedSite(slug: string) {
  return db.site.findUnique({
    where: { slug, published: true },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } }
          }
        }
      }
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, key: string, fallback = ""): string {
  if (!isRecord(value)) return fallback;
  const field = value[key];
  return typeof field === "string" ? field : fallback;
}

function getTheme(value: unknown): Theme {
  const fallback: Theme = {
    colors: { primary: "#6558a6", secondary: "#e5e0f2", background: "#fbfaf8", text: "#292722", accent: "#b18a62" },
    buttons: { radius: 5, style: "plein" },
    typography: { headingFont: "Georgia", bodyFont: "Arial", h1: 58, h2: 36, h3: 24, body: 16, weight: 500 }
  };
  if (!isRecord(value) || !isRecord(value.colors)) return fallback;
  const keys = ["primary", "secondary", "background", "text", "accent"] as const;
  const colors = { ...fallback.colors };
  for (const key of keys) {
    const color = value.colors[key];
    if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color)) colors[key] = color;
  }
  const typography = isRecord(value.typography) ? value.typography : {};
  const fonts = ["Arial", "Georgia", "Verdana", "Trebuchet MS"];
  const headingFont = typeof typography.headingFont === "string" && fonts.includes(typography.headingFont) ? typography.headingFont : fallback.typography.headingFont;
  const bodyFont = typeof typography.bodyFont === "string" && fonts.includes(typography.bodyFont) ? typography.bodyFont : fallback.typography.bodyFont;
  const boundedSize = (key: "h1" | "h2" | "h3" | "body") => {
    const candidate = typography[key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) return fallback.typography[key];
    return Math.max(key === "body" ? 12 : 18, Math.min(key === "body" ? 24 : 80, candidate));
  };
  const buttons = isRecord(value.buttons) ? value.buttons : {};
  const radius = typeof buttons.radius === "number" && Number.isFinite(buttons.radius) ? Math.max(0, Math.min(24, buttons.radius)) : fallback.buttons.radius;
  const buttonStyle = buttons.style === "contour" ? "contour" : "plein";
  return {
    colors,
    typography: { headingFont, bodyFont, h1: boundedSize("h1"), h2: boundedSize("h2"), h3: boundedSize("h3"), body: boundedSize("body"), weight: 500 },
    buttons: { radius, style: buttonStyle }
  };
}

export async function PublishedSite({ slug, pageSlug }: { slug: string; pageSlug?: string }) {
  const site = await getPublishedSite(slug);
  if (!site) notFound();
  const page = pageSlug ? site.pages.find((item) => item.slug === pageSlug) : site.pages[0];
  if (!page) notFound();
  const theme = getTheme(site.theme);
  const style = {
    "--published-bg": theme.colors.background,
    "--published-text": theme.colors.text,
    "--published-primary": theme.colors.primary,
    "--published-secondary": theme.colors.secondary,
    "--published-accent": theme.colors.accent,
    "--published-heading-font": theme.typography.headingFont,
    "--published-body-font": theme.typography.bodyFont,
    "--published-radius": `${theme.buttons.radius}px`,
    "--published-h1": `${theme.typography.h1}px`,
    "--published-h2": `${theme.typography.h2}px`,
    "--published-h3": `${theme.typography.h3}px`,
    "--published-body-size": `${theme.typography.body}px`,
    "--published-button-bg": theme.buttons.style === "plein" ? theme.colors.primary : "transparent",
    "--published-button-text": theme.buttons.style === "plein" ? "#ffffff" : theme.colors.primary
  } as React.CSSProperties;

  return <main className={`published-site design-${site.design ?? "minimal"} ${site.templateId === "portfolio-editorial" ? "editorial-site" : ""}`} style={style}>
    <header className="published-header">
      <a href={`/sites/${site.slug}`} className="published-brand">{site.title}</a>
      <nav aria-label="Navigation principale">{site.pages.map((item) => <a key={item.id} className={item.id === page.id ? "current" : ""} href={item.slug === "accueil" ? `/sites/${site.slug}` : `/sites/${site.slug}/${item.slug}`}>{item.title}</a>)}</nav>
    </header>
    <div className="published-page">
      {page.sections.map((section) => <section className={`published-section ${site.templateId === "portfolio-editorial" ? "editorial-section" : ""}`} key={section.id}>
        {section.blocks.map((block) => {
          const heading = readString(block.content, "heading", section.type);
          const body = readString(block.content, "body");
          const action = readString(block.content, "action", "En savoir plus");
          const image = readString(block.content, "image");
          const type = block.type;
          if (type === "divider") return <hr key={block.id} />;
          const headingSize = section.blocks[0]?.id === block.id ? theme.typography.h2 : theme.typography.h3;
          const publishedHeadingSize = `clamp(28px, ${section.blocks[0]?.id === block.id ? theme.typography.h1 : headingSize}px, 82px)`;
          const galleryItems = isRecord(block.content) && Array.isArray(block.content.items)
            ? block.content.items.filter((item): item is string => typeof item === "string")
            : ["Étude de lumière", "Matière en mouvement", "Paysage intérieur"];
          const galleryImages = isRecord(block.content) && Array.isArray(block.content.images)
            ? block.content.images.filter((item): item is string => typeof item === "string")
            : [];
          const galleryCaptions = isRecord(block.content) && Array.isArray(block.content.imageCaptions)
            ? block.content.imageCaptions.filter((item): item is string => typeof item === "string")
            : [];
          const gallerySources = isRecord(block.content) && Array.isArray(block.content.imageSources)
            ? block.content.imageSources.filter((item): item is string => typeof item === "string" && item.startsWith("https://commons.wikimedia.org/"))
            : [];
          const galleryCategories = isRecord(block.content) && Array.isArray(block.content.categories)
            ? block.content.categories
            : isRecord(block.content) && typeof block.content.categories === "string" ? block.content.categories.split(",") : [];
          const galleryWorks = galleryItems.map((item, index) => ({
            title: galleryCaptions[index] ?? item,
            image: galleryImages[index],
            category: typeof galleryCategories[index] === "string" ? galleryCategories[index].trim() : ""
          }));
          return <div key={block.id} className={`published-block block-${type} ${site.templateId === "portfolio-editorial" ? `editorial-block editorial-${type} ${type === "hero" && image ? "has-editorial-image" : ""}` : ""}`}>
            {readString(block.content, "label") && <p className="published-eyebrow">{readString(block.content, "label")}</p>}
            <h1 style={{ fontSize: publishedHeadingSize, "--published-heading-size": publishedHeadingSize } as React.CSSProperties}>{heading}</h1>
            {body && <p className="published-copy">{body}</p>}
            {image && <img className="published-image" src={image} alt={heading} />}
            {type === "gallery" && <>
              <GalleryLightbox works={galleryWorks} className="published-gallery" />
              {gallerySources.length > 0 && <p className="published-image-credit">Images du domaine public · <a href={gallerySources[0]} target="_blank" rel="noreferrer">La Joconde</a> · <a href={gallerySources[1]} target="_blank" rel="noreferrer">La Cène</a> · <a href={gallerySources[2]} target="_blank" rel="noreferrer">Portrait attribué</a> — Wikimedia Commons</p>}
            </>}
            {type === "events" && <div className="published-event"><span>À VENIR</span><p>{body}</p></div>}
            {type === "audio" && <div className="published-media">♫　Écouter un extrait</div>}
            {type === "video" && <div className="published-media">▶　Voir le film</div>}
            {type === "contact" && <ContactForm email={readString(block.content, "email", "bonjour@atelier-exemple.fr")} subject={`${site.title} — ${heading}`} />}
            {["hero", "cta", "pricing"].includes(type) && <a className="published-button" href="#contact">{action}</a>}
            {type === "team" && <div className="published-team"><span>Artistes</span><span>Création</span><span>Rencontres</span></div>}
            {type === "testimonials" && <blockquote>« Une belle rencontre et un travail profondément singulier. »</blockquote>}
            {type === "faq" && <details><summary>Comment prendre contact ?</summary><p>{body || "Écrivez-nous, nous vous répondrons rapidement."}</p></details>}
            {type === "map" && <p className="published-media">⌖　{body}</p>}
            {type === "stats" && <div className="published-team"><span>12 ans de création</span><span>48 projets</span><span>6 expositions</span></div>}
            {type === "social" && <p className="published-copy">Instagram　·　Vimeo　·　Newsletter</p>}
            {type === "footer" && <p className="published-copy">© {site.title} · Création indépendante</p>}
          </div>;
        })}
      </section>)}
    </div>
    <footer className="published-footer">Un site d'artiste · <a href="/">SANAA</a></footer>
  </main>;
}

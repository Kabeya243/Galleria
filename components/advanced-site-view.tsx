// Public view of a published advanced site (Claude « atelier-sites »,
// integrated 8 Nov 2026). Adapted from the standalone builder's
// src/app/sites/[slug]/site-view.tsx: Prisma client replaced by SANAA's
// db (lib/db), published.css imported once in app/layout.tsx instead of
// here, footer links back to SANAA. Only published sites render;
// getPublishedSite is also used by the /sites/[slug] route metadata.
//
// UI/UX pass (8 Nov 2026): burger navigation on mobile, full footer
// (site nav, contact, social links, copyright, back to top), lucide
// icons instead of text glyphs, one h1 per page, visible focus states.
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUp, BarChart3, CalendarDays, Clapperboard, Globe, Instagram, Mail, MapPin, Music, Palette, Sparkles, Users } from "lucide-react";
import { db } from "@/lib/db";
import type { Theme } from "@/lib/advanced-site-types";
import { ContactForm } from "@/components/advanced-site-contact-form";
import { GalleryLightbox } from "@/components/advanced-site-gallery-lightbox";
import { PublishedSiteNav } from "@/components/advanced-site-nav";

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

type SocialLink = { label: string; href?: string };

function socialIconFor(label: string) {
  const text = label.toLowerCase();
  if (text.includes("instagram")) return Instagram;
  if (text.includes("vimeo") || text.includes("vidéo") || text.includes("video") || text.includes("youtube")) return Clapperboard;
  if (text.includes("newsletter") || text.includes("mail") || text.includes("courriel")) return Mail;
  return Globe;
}

function socialLinksFromItems(items: unknown): SocialLink[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 5)
    .map((item) => {
      const text = item.trim();
      if (/^https?:\/\//i.test(text)) {
        const label = /instagram/i.test(text) ? "Instagram"
          : /vimeo/i.test(text) ? "Vimeo"
          : /youtube/i.test(text) ? "YouTube"
          : /facebook/i.test(text) ? "Facebook"
          : /linkedin/i.test(text) ? "LinkedIn"
          : "Site web";
        return { label, href: text };
      }
      if (text.startsWith("@")) return { label: text, href: `https://instagram.com/${text.slice(1)}` };
      return { label: text };
    });
}

type FooterPage = { id: string; slug: string; title: string };

function SocialLinks({ socials }: { socials: SocialLink[] }) {
  if (socials.length === 0) return null;
  return (
    <div className="published-footer-social">
      {socials.map((social) => {
        const Icon = socialIconFor(social.label);
        const content = <><Icon size={15} aria-hidden="true" />{social.label}</>;
        return social.href
          ? <a key={social.label} href={social.href} target="_blank" rel="noreferrer">{content}</a>
          : <span key={social.label}>{content}</span>;
      })}
    </div>
  );
}

function PublishedSiteFooter({
  siteSlug,
  siteTitle,
  pages,
  contactEmail,
  socials,
  tagline
}: {
  siteSlug: string;
  siteTitle: string;
  pages: FooterPage[];
  contactEmail: string;
  socials: SocialLink[];
  tagline?: string;
}) {
  const year = new Date().getFullYear();
  const pageHref = (item: FooterPage) => (item.slug === "accueil" ? `/sites/${siteSlug}` : `/sites/${siteSlug}/${item.slug}`);
  return (
    <footer className="published-site-footer">
      <div className="published-footer-inner">
        <div>
          <a href={`/sites/${siteSlug}`} className="published-footer-title">{siteTitle}</a>
          {tagline && <p className="published-footer-tagline">{tagline}</p>}
        </div>
        <nav aria-label="Navigation du pied de page">
          <p className="published-footer-heading">Naviguer</p>
          <div className="published-footer-nav">
            {pages.map((item) => <a key={item.id} href={pageHref(item)}>{item.title}</a>)}
          </div>
        </nav>
        <div>
          <p className="published-footer-heading">Contact</p>
          {contactEmail
            ? <p className="published-footer-contact"><a href={`mailto:${contactEmail}`}><Mail size={15} aria-hidden="true" />{contactEmail}</a></p>
            : <p className="published-footer-tagline">Écrivez-nous via le formulaire de contact du site.</p>}
        </div>
        <div>
          <p className="published-footer-heading">Suivre</p>
          <SocialLinks socials={socials} />
        </div>
      </div>
      <div className="published-footer-bottom">
        <p>© {year} {siteTitle} · Création indépendante</p>
        <p>Un site d&apos;artiste · <a href="/">SANAA</a></p>
        <a href="#top" className="published-back-to-top"><ArrowUp size={14} aria-hidden="true" />Retour en haut</a>
      </div>
    </footer>
  );
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

  // Site-wide footer data, collected from every page so the footer is
  // complete even when the contact / social blocks live on another page.
  const allBlocks = site.pages.flatMap((item) => item.sections.flatMap((section) => section.blocks));
  const contactBlock = allBlocks.find((block) => block.type === "contact");
  const contactEmail = readString(contactBlock?.content, "email");
  const socialBlock = allBlocks.find((block) => block.type === "social");
  const socials = socialLinksFromItems(isRecord(socialBlock?.content) ? socialBlock.content.items : undefined);
  const fallbackSocials: SocialLink[] = socials.length > 0
    ? socials
    : [{ label: "Instagram" }, { label: "Vimeo" }, { label: "Newsletter" }];
  const footerPages: FooterPage[] = site.pages.map((item) => ({ id: item.id, slug: item.slug, title: item.title }));
  const hasFooterBlock = page.sections.some((section) => section.blocks.some((block) => block.type === "footer"));
  const firstBlockId = page.sections[0]?.blocks[0]?.id;

  return <main id="top" className={`published-site design-${site.design ?? "minimal"} ${site.templateId === "portfolio-editorial" ? "editorial-site" : ""}`} style={style}>
    <a href="#contenu" className="published-skip-link">Aller au contenu</a>
    <header className="published-header">
      <a href={`/sites/${site.slug}`} className="published-brand">{site.title}</a>
      <PublishedSiteNav siteSlug={site.slug} pages={footerPages} currentPageId={page.id} />
    </header>
    <div className="published-page" id="contenu">
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
          // A footer block renders the full site footer; a social block
          // renders the icon row. Both replace the generic heading/body.
          if (type === "footer") {
            return <div key={block.id} className="published-block block-footer">
              <PublishedSiteFooter siteSlug={site.slug} siteTitle={site.title} pages={footerPages} contactEmail={contactEmail} socials={fallbackSocials} tagline={body || undefined} />
            </div>;
          }
          if (type === "social") {
            const blockSocials = socialLinksFromItems(isRecord(block.content) ? block.content.items : undefined);
            return <div key={block.id} className="published-block block-social">
              {heading && <h2 style={{ fontSize: publishedHeadingSize, "--published-heading-size": publishedHeadingSize } as React.CSSProperties}>{heading}</h2>}
              {body && <p className="published-copy">{body}</p>}
              <SocialLinks socials={blockSocials.length > 0 ? blockSocials : fallbackSocials} />
            </div>;
          }
          const HeadingTag = (block.id === firstBlockId ? "h1" : "h2") as "h1" | "h2";
          return <div key={block.id} id={type === "contact" ? "contact" : undefined} className={`published-block block-${type} ${site.templateId === "portfolio-editorial" ? `editorial-block editorial-${type} ${type === "hero" && image ? "has-editorial-image" : ""}` : ""}`}>
            {readString(block.content, "label") && <p className="published-eyebrow">{readString(block.content, "label")}</p>}
            <HeadingTag style={{ fontSize: publishedHeadingSize, "--published-heading-size": publishedHeadingSize } as React.CSSProperties}>{heading}</HeadingTag>
            {body && <p className="published-copy">{body}</p>}
            {image && <img className="published-image" src={image} alt={heading} />}
            {type === "gallery" && <>
              <GalleryLightbox works={galleryWorks} className="published-gallery" />
              {gallerySources.length > 0 && <p className="published-image-credit">Images du domaine public · <a href={gallerySources[0]} target="_blank" rel="noreferrer">La Joconde</a> · <a href={gallerySources[1]} target="_blank" rel="noreferrer">La Cène</a> · <a href={gallerySources[2]} target="_blank" rel="noreferrer">Portrait attribué</a> — Wikimedia Commons</p>}
            </>}
            {type === "events" && <div className="published-event"><span>À VENIR</span><p><CalendarDays size={16} aria-hidden="true" />{body}</p></div>}
            {type === "audio" && <div className="published-media"><Music size={16} aria-hidden="true" />Écouter un extrait</div>}
            {type === "video" && <div className="published-media"><Clapperboard size={16} aria-hidden="true" />Voir le film</div>}
            {type === "contact" && <ContactForm email={readString(block.content, "email", "bonjour@atelier-exemple.fr")} subject={`${site.title} — ${heading}`} />}
            {["hero", "cta", "pricing"].includes(type) && <a className="published-button" href="#contact">{action}<ArrowRight size={14} aria-hidden="true" /></a>}
            {type === "team" && <div className="published-team"><span><Users size={20} aria-hidden="true" />Artistes</span><span><Palette size={20} aria-hidden="true" />Création</span><span><Sparkles size={20} aria-hidden="true" />Rencontres</span></div>}
            {type === "testimonials" && <blockquote>« Une belle rencontre et un travail profondément singulier. »</blockquote>}
            {type === "faq" && <details><summary>Comment prendre contact ?</summary><p>{body || "Écrivez-nous, nous vous répondrons rapidement."}</p></details>}
            {type === "map" && <p className="published-media"><MapPin size={16} aria-hidden="true" />{body}</p>}
            {type === "stats" && <div className="published-team"><span><BarChart3 size={20} aria-hidden="true" />12 ans de création</span><span><BarChart3 size={20} aria-hidden="true" />48 projets</span><span><BarChart3 size={20} aria-hidden="true" />6 expositions</span></div>}
          </div>;
        })}
      </section>)}
    </div>
    {!hasFooterBlock && <PublishedSiteFooter siteSlug={site.slug} siteTitle={site.title} pages={footerPages} contactEmail={contactEmail} socials={fallbackSocials} />}
  </main>;
}

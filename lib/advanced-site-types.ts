// Types of the advanced website builder (Claude « atelier-sites »,
// integrated 8 Nov 2026). Verbatim copy of the standalone builder's
// src/lib/types.ts, import path adapted to SANAA.
export type BlockType =
  | "hero"
  | "text"
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "cta"
  | "contact"
  | "testimonials"
  | "pricing"
  | "events"
  | "faq"
  | "map"
  | "footer"
  | "divider"
  | "social"
  | "stats"
  | "team";

export type Theme = {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  buttons: { radius: number; style: "plein" | "contour" };
  typography: {
    headingFont: string;
    bodyFont: string;
    h1: number;
    h2: number;
    h3: number;
    body: number;
    weight: number;
  };
};

export type ContentValue = string | number | boolean | string[];

export type Block = {
  id: string;
  type: BlockType;
  content: Record<string, ContentValue>;
};

export type Section = {
  id: string;
  title: string;
  blocks: Block[];
};

export type SitePage = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  sections: Section[];
};

export type SiteDesign =
  | "editorial"
  | "canvas"
  | "lookbook"
  | "brutalist"
  | "minimal"
  | "stage"
  | "literary"
  | "movement"
  | "cinema"
  | "collective"
  | "craft";

export type SiteDocument = {
  id: string;
  slug: string;
  publishedSlug?: string | null;
  title: string;
  templateId: string;
  design?: SiteDesign;
  theme: Theme;
  published: boolean;
  pages: SitePage[];
};

export type TemplateSection = {
  title: string;
  type: BlockType;
  heading: string;
  body: string;
  items?: string[];
  image?: string;
  images?: string[];
  imageCaptions?: string[];
  categories?: string[];
  imageSources?: string[];
};

export type TemplateSummary = {
  id: string;
  name: string;
  siteTitle?: string;
  coverImage?: string;
  design: SiteDesign;
  category: string;
  description: string;
  colors: Theme["colors"];
  hero: string;
  pages: string[];
  sections: TemplateSection[];
  pageSections?: TemplateSection[][];
};

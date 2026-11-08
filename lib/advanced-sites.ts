// Advanced website builder — server helpers (PostgreSQL via Prisma).
// Maps between the editor's SiteDocument (lib/advanced-site-types.ts)
// and the relational models Site/Page/Section/Block, validates incoming
// documents, and seeds the 11 original templates into the Template table.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { templates } from "@/lib/advanced-site-templates";
import type { SiteDocument, TemplateSummary } from "@/lib/advanced-site-types";

export const ADVANCED_SITE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSiteDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const site = value as Partial<SiteDocument>;
  return (
    typeof site.id === "string" &&
    typeof site.slug === "string" &&
    ADVANCED_SITE_SLUG_RE.test(site.slug) &&
    typeof site.title === "string" &&
    typeof site.published === "boolean" &&
    Array.isArray(site.pages) &&
    typeof site.theme === "object" &&
    site.pages.every(
      (page) =>
        page &&
        typeof page.id === "string" &&
        typeof page.slug === "string" &&
        typeof page.title === "string" &&
        Array.isArray(page.sections) &&
        page.sections.every(
          (section) =>
            section &&
            typeof section.id === "string" &&
            Array.isArray(section.blocks) &&
            section.blocks.every(
              (block) =>
                block &&
                typeof block.id === "string" &&
                typeof block.type === "string" &&
                typeof block.content === "object",
            ),
        ),
    )
  );
}

const siteInclude = {
  pages: {
    orderBy: { order: "asc" as const },
    include: {
      sections: {
        orderBy: { order: "asc" as const },
        include: { blocks: { orderBy: { order: "asc" as const } } },
      },
    },
  },
} as const;

type DbSite = Prisma.SiteGetPayload<{ include: typeof siteInclude }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rebuild the editor document from a Prisma site with nested pages. */
export function siteDocumentFromDb(site: DbSite): SiteDocument {
  return {
    id: site.id,
    slug: site.slug,
    publishedSlug: site.published ? site.slug : null,
    title: site.title,
    templateId: site.templateId ?? "",
    design: (site.design ?? "minimal") as SiteDocument["design"],
    theme: site.theme as unknown as SiteDocument["theme"],
    published: site.published,
    pages: site.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      seoTitle: page.seoTitle ?? "",
      seoDescription: page.seoDescription ?? "",
      sections: page.sections.map((section) => ({
        id: section.id,
        title: isRecord(section.settings) && typeof section.settings.title === "string" ? section.settings.title : "",
        blocks: section.blocks.map((block) => ({
          id: block.id,
          type: block.type as SiteDocument["pages"][number]["sections"][number]["blocks"][number]["type"],
          content: (isRecord(block.content) ? block.content : {}) as Record<string, string | number | boolean | string[]>,
        })),
      })),
    })),
  };
}

/** Full nested create payload for one SiteDocument (pages/sections/blocks). */
function toCreateInput(site: SiteDocument) {
  return {
    id: site.id,
    slug: site.slug,
    title: site.title,
    templateId: site.templateId || null,
    design: site.design ?? null,
    theme: site.theme as Prisma.InputJsonValue,
    published: site.published,
    pages: {
      create: site.pages.map((page, pageIndex) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        seoTitle: page.seoTitle || null,
        seoDescription: page.seoDescription || null,
        order: pageIndex,
        sections: {
          create: page.sections.map((section, sectionIndex) => ({
            id: section.id,
            type: "content",
            order: sectionIndex,
            settings: { title: section.title },
            blocks: {
              create: section.blocks.map((block, blockIndex) => ({
                id: block.id,
                type: block.type,
                order: blockIndex,
                content: block.content as Prisma.InputJsonValue,
                settings: {},
              })),
            },
          })),
        },
      })),
    },
  };
}

/**
 * Upsert a whole site document for one owner: creates the site (with the
 * client-generated id) or replaces its pages/sections/blocks wholesale
 * inside a transaction. The slug must stay unique across ALL users
 * (it is the public URL), so a slug owned by someone else is rejected.
 */
export async function saveAdvancedSite(userId: string, site: SiteDocument) {
  const clash = await db.site.findUnique({ where: { slug: site.slug }, select: { id: true, userId: true } });
  if (clash && clash.userId !== userId && clash.id !== site.id) {
    throw new Error("Ce nom d'URL est déjà utilisé par un autre site.");
  }
  const existing = await db.site.findFirst({ where: { id: site.id, userId }, select: { id: true } });
  const input = toCreateInput(site);
  if (!existing) {
    return db.site.create({ data: { ...input, userId }, include: siteInclude });
  }
  return db.$transaction(async (tx) => {
    await tx.page.deleteMany({ where: { siteId: site.id } });
    return tx.site.update({
      where: { id: site.id },
      data: {
        slug: site.slug,
        title: site.title,
        templateId: site.templateId || null,
        design: site.design ?? null,
        theme: site.theme as Prisma.InputJsonValue,
        published: site.published,
        pages: { create: input.pages.create },
      },
      include: siteInclude,
    });
  });
}

export async function listAdvancedSites(userId: string) {
  const rows = await db.site.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: siteInclude,
  });
  return rows.map((row) => siteDocumentFromDb(row));
}

/** The 11 template definitions, from the Template table (seeded if empty). */
export async function getSiteTemplates(): Promise<TemplateSummary[]> {
  await ensureSiteTemplates();
  const rows = await db.template.findMany({ orderBy: { id: "asc" } });
  return rows.map((row) => row.definition as unknown as TemplateSummary);
}

/** Upsert the 11 bundled template definitions — never deletes anything. */
export async function ensureSiteTemplates(): Promise<number> {
  for (const template of templates) {
    await db.template.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        name: template.name,
        category: template.category,
        definition: template as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: template.name,
        category: template.category,
        definition: template as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return templates.length;
}

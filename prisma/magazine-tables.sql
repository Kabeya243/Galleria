-- Magazine tables (Nov 2026). DDL written to match what `prisma db push`
-- generates from prisma/schema.prisma (quoted identifiers, Prisma
-- constraint/index names), so the deploy-time db push sees no diff.
-- Run once against production; safe to re-run (IF NOT EXISTS / guards).

CREATE TABLE IF NOT EXISTS "MagazineArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImageUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "MagazineArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MagazineArticle_slug_key" ON "MagazineArticle"("slug");
CREATE INDEX IF NOT EXISTS "MagazineArticle_status_publishedAt_idx" ON "MagazineArticle"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "MagazineArticle_authorId_idx" ON "MagazineArticle"("authorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MagazineArticle_authorId_fkey'
  ) THEN
    ALTER TABLE "MagazineArticle"
      ADD CONSTRAINT "MagazineArticle_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MagazineView" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MagazineView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MagazineView_articleId_visitorKey_day_key" ON "MagazineView"("articleId", "visitorKey", "day");
CREATE INDEX IF NOT EXISTS "MagazineView_articleId_day_idx" ON "MagazineView"("articleId", "day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MagazineView_articleId_fkey'
  ) THEN
    ALTER TABLE "MagazineView"
      ADD CONSTRAINT "MagazineView_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "MagazineArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

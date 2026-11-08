CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "coverImageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVisible" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Post_exhibitionId_key" UNIQUE ("exhibitionId"),
    CONSTRAINT "Post_exhibitionId_fkey"
        FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE,
    CONSTRAINT "Post_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "Like" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Like_postId_userId_key" UNIQUE ("postId", "userId"),
    CONSTRAINT "Like_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE,
    CONSTRAINT "Like_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "Post_feed_createdAt_id_idx"
    ON "Post" ("createdAt" DESC, "id" DESC)
    WHERE "isVisible" = TRUE;
CREATE INDEX "Like_postId_idx" ON "Like" ("postId");

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseProfileData } from "@/lib/profile";

// The publication feed (Nov 2026): GET lists visible posts — one per
// published exhibition — newest first, 12 per page, cursor pagination
// (the cursor is the last post id of the previous page). The route
// never existed before: the feed page fetched it and got a 404, so the
// feed only ever showed its error state. Public: anyone can read it;
// a signed-in reader also gets likedByMe for each post.

const PAGE_SIZE = 12;

export async function GET(request: Request) {
  const viewer = await getCurrentUser().catch(() => null);
  const cursorId = new URL(request.url).searchParams.get("cursor");
  let cursorCreatedAt: Date | null = null;
  if (cursorId) {
    const cursorPost = await db.post.findUnique({
      where: { id: cursorId },
      select: { createdAt: true },
    });
    if (cursorPost) cursorCreatedAt = cursorPost.createdAt;
  }

  const rows = await db.post.findMany({
    where: {
      isVisible: true,
      exhibition: { status: "public" },
      ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      coverImageUrl: true,
      createdAt: true,
      exhibition: { select: { title: true, slug: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Avatars live in SavedWork profile rows; one query for the page.
  const authorIds = [...new Set(page.map((post) => post.author.id))];
  const profiles = authorIds.length
    ? await db.savedWork.findMany({
        where: { userId: { in: authorIds }, kind: "profile" },
        select: { userId: true, data: true },
      })
    : [];
  const avatarByUser = new Map<string, string | null>();
  for (const row of profiles) {
    try {
      avatarByUser.set(row.userId, parseProfileData(JSON.parse(row.data) as unknown).avatarUrl);
    } catch {
      // A corrupt profile row just means no avatar for that author.
    }
  }

  // likedByMe for the signed-in viewer; one query for the page.
  const likedIds = new Set<string>();
  if (viewer && page.length) {
    const likes = await db.like.findMany({
      where: { userId: viewer.id, postId: { in: page.map((post) => post.id) } },
      select: { postId: true },
    });
    for (const like of likes) likedIds.add(like.postId);
  }

  return NextResponse.json({
    posts: page.map((post) => ({
      id: post.id,
      coverImageUrl: post.coverImageUrl,
      createdAt: post.createdAt.toISOString(),
      title: post.exhibition.title,
      artist: { name: post.author.name, avatarUrl: avatarByUser.get(post.author.id) ?? null },
      likeCount: post._count.likes,
      likedByMe: likedIds.has(post.id),
      visitUrl: `/exhibition/${post.exhibition.slug}`,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  });
}

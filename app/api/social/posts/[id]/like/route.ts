import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Like / unlike a feed post (Nov 2026). The route never existed
// before — the feed's like button fetched it and got a 404. Signed-in
// only; one like per user per post (@@unique on Like). Both verbs
// answer { likeCount }, which is what the feed client reads.

async function countLikes(postId: string) {
  return db.like.count({ where: { postId } });
}

async function findVisiblePost(id: string) {
  return db.post.findUnique({ where: { id }, select: { id: true, isVisible: true } });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to like a post." }, { status: 401 });
  const { id } = await params;
  const post = await findVisiblePost(id);
  if (!post || !post.isVisible) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  await db.like.upsert({
    where: { postId_userId: { postId: id, userId: user.id } },
    update: {},
    create: { postId: id, userId: user.id },
  });
  return NextResponse.json({ likeCount: await countLikes(id) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to unlike a post." }, { status: 401 });
  const { id } = await params;
  const post = await findVisiblePost(id);
  if (!post || !post.isVisible) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  await db.like.deleteMany({ where: { postId: id, userId: user.id } });
  return NextResponse.json({ likeCount: await countLikes(id) });
}

import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/lib/magazine";

// Public magazine list: published articles, newest first. No sign-in.
export async function GET() {
  const articles = await getPublishedArticles();
  return NextResponse.json({ articles });
}

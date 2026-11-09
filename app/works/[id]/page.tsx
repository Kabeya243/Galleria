import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorksPage from "@/components/works-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserProfile } from "@/lib/profile";
import { classifyWorkKind, getWorkKindOverrides, type WorkKind } from "@/lib/works";

type RouteProps = { params: Promise<{ id: string }> };

// Public creator wall: "Mes travaux / designs / créations". The header
// shows the creator (photo, name, bio); the wall shows their works from
// every exhibition, filterable by kind (œuvre / design / création).
// Visitors only see works from published exhibitions; the owner, signed
// in, sees everything (including drafts) and can tag each work's kind
// right on the wall. No sign-in is needed to view.

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id } = await params;
  const creator = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!creator) return { title: "Creator not found: Lakisa" };
  return { title: `${creator.name}: Works, designs & creations: Lakisa` };
}

export default async function WorksRoute({ params }: RouteProps) {
  const { id } = await params;
  const [creator, viewer] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, name: true } }),
    getCurrentUser(),
  ]);
  if (!creator) notFound();
  const isOwner = viewer?.id === creator.id;
  const [profile, overrides, exhibitions] = await Promise.all([
    getUserProfile(creator.id),
    getWorkKindOverrides(creator.id),
    db.exhibition.findMany({
      where: { ownerId: creator.id },
      select: {
        id: true,
        title: true,
        status: true,
        artworks: {
          select: {
            id: true,
            title: true,
            year: true,
            medium: true,
            dimensions: true,
            description: true,
            color: true,
            accent: true,
            imageUrl: true,
            videoUrl: true,
            sculptureUrl: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const works = exhibitions.flatMap((ex) =>
    (isOwner || ex.status === "public"
      ? ex.artworks.map((a) => ({
          id: a.id,
          title: a.title,
          year: a.year,
          medium: a.medium,
          dimensions: a.dimensions,
          description: a.description,
          color: a.color,
          accent: a.accent,
          imageUrl: a.imageUrl,
          videoUrl: a.videoUrl,
          sculptureUrl: a.sculptureUrl,
          exhibitionTitle: ex.title,
          kind: classifyWorkKind(a, overrides, a.id) as WorkKind,
        }))
      : []),
  );

  return (
    <WorksPage
      creator={{ id: creator.id, name: creator.name, avatarUrl: profile.avatarUrl, bio: profile.bio }}
      works={works}
      isOwner={isOwner}
    />
  );
}

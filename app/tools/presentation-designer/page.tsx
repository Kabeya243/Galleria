import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import PresentationDesigner from "@/components/presentation-designer";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Presentation Designer: Lakisa Tools",
  description:
    "Build a professional art presentation (portfolio, gallery proposal or art-fair application) from your own artworks, then export it as a PDF.",
};

export default async function PresentationDesignerRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("presentation-designer", user.id);
  const { exhibitionId } = await searchParams;
  // Deep-link context (Art in Context step 10): when the catalogue is
  // started from an exhibition, title the deck after it.
  const linkedExhibition = exhibitionId
    ? await db.exhibition.findFirst({
        where: { id: exhibitionId, ownerId: user.id },
        select: { title: true, description: true },
      })
    : null;
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        artist: true,
        year: true,
        medium: true,
        dimensions: true,
        description: true,
        color: true,
        accent: true,
        imageUrl: true,
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="presentationDesigner"
      eyebrow="presentationDesignerEyebrow"
      description="presentationDesignerDesc"
    >
      <PresentationDesigner
        artworks={artworks.map((a) => ({ ...a, exhibitionTitle: a.exhibition.title }))}
        userName={user.name}
        initialTitle={linkedExhibition?.title}
        initialCuratorialText={linkedExhibition?.description ?? undefined}
      />
    </ToolsShell>
  );
}

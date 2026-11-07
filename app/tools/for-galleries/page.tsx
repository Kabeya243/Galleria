import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Galleries — SANAA Tools",
  description: "Artworks, collectors, exhibitions and sales in one platform.",
};

export default async function ForGalleriesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("for-galleries", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="forGalleries"
      eyebrow="forGalleriesEyebrow"
      description="forGalleriesDesc"
      points={[
        {
          heading: "forGalleriesP1h",
          text: "forGalleriesP1t",
        },
        {
          heading: "forGalleriesP2h",
          text: "forGalleriesP2t",
        },
        {
          heading: "forGalleriesP3h",
          text: "forGalleriesP3t",
        },
        {
          heading: "forGalleriesP4h",
          text: "forGalleriesP4t",
        },
      ]}
    />
  );
}

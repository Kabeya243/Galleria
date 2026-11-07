import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Artists — SANAA Tools",
  description: "Run your studio from one place: inventory, pricing, sales and documents.",
};

export default async function ForArtistsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("for-artists", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="forArtists"
      eyebrow="forArtistsEyebrow"
      description="forArtistsDesc"
      points={[
        {
          heading: "forArtistsP1h",
          text: "forArtistsP1t",
        },
        {
          heading: "forArtistsP2h",
          text: "forArtistsP2t",
        },
        {
          heading: "forArtistsP3h",
          text: "forArtistsP3t",
        },
        {
          heading: "forArtistsP4h",
          text: "forArtistsP4t",
        },
      ]}
    />
  );
}

import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Collectors — SANAA Tools",
  description: "Keep track of what you own, what it is worth, and where it came from.",
};

export default async function ForCollectorsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("for-collectors", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="For Collectors"
      eyebrow="TOOLS · FOR COLLECTORS"
      description="What you own, what it is worth, and where it came from — kept in one place, with the documents that prove it."
      points={[
        {
          heading: "Your collection, in one list",
          text: "Every work you own, with its artist, medium, dimensions and year — and the exhibition it came from.",
        },
        {
          heading: "Provenance and documents",
          text: "A certificate of authenticity for each work, so the story of the piece travels with it.",
        },
        {
          heading: "Walk through a show from home",
          text: "A gallery's viewing room lets you stand in front of the work before you decide.",
        },
        {
          heading: "Price with a clear head",
          text: "See what a piece cost to make and what it sells for — a fair price is one you understand.",
        },
      ]}
    />
  );
}

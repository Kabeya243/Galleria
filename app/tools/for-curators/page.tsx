import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Curators — SANAA Tools",
  description: "Build exhibitions, and keep the works and the people around them in order.",
};

export default async function ForCuratorsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="For Curators"
      eyebrow="TOOLS · FOR CURATORS"
      description="Build the show, then keep everything around it in order — the works, the artists, the lenders and the visitors."
      points={[
        {
          heading: "Build the exhibition",
          text: "Choose a room, hang the works at their real size, and walk through the hang before anyone else does.",
        },
        {
          heading: "Keep the works in order",
          text: "An inventory of everything in the show — medium, dimensions, year, and where each piece came from.",
        },
        {
          heading: "Know the people",
          text: "Artists, lenders, collectors and advisors in one contact list, with a note on each of them.",
        },
        {
          heading: "Present it as a viewing room",
          text: "Publish the room and share one link — the jury, the press or a collector walks through it from anywhere.",
        },
      ]}
    />
  );
}

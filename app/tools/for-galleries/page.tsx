import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Galleries — SANAA Tools",
  description: "Artworks, collectors, exhibitions and sales in one platform.",
};

export default async function ForGalleriesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="For Galleries"
      eyebrow="TOOLS · FOR GALLERIES"
      description="The gallery's everyday work in one platform — the artworks, the collectors, the exhibitions and the sales."
      points={[
        {
          heading: "Artworks and inventory",
          text: "Every work in the gallery, with its details and its history — what is on the wall, what is in storage, what is sold.",
        },
        {
          heading: "Collectors and relationships",
          text: "Who collects what, who came to which opening, and what to follow up on — kept in one place.",
        },
        {
          heading: "Exhibitions as viewing rooms",
          text: "Publish a show and share it as a room people walk through, with the works at their real size.",
        },
        {
          heading: "Documents for every sale",
          text: "Certificates of authenticity and artwork sheets, printed from the work itself.",
        },
      ]}
    />
  );
}

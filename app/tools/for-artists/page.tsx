import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Artists — SANAA Tools",
  description: "Run your studio from one place: inventory, pricing, sales and documents.",
};

export default async function ForArtistsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="For Artists"
      eyebrow="TOOLS · FOR ARTISTS"
      description="Your studio, run from one place. Hang the work, price it, know who is looking at it, and send the documents that go with a sale."
      points={[
        {
          heading: "Studio inventory",
          text: "Every work you make, listed with its medium, its size and where it is — in a show, in the studio, or sold.",
        },
        {
          heading: "Price your work",
          text: "Start from your hours and your materials, and get a range you can stand behind when a collector asks.",
        },
        {
          heading: "Exhibitions that travel",
          text: "Build a room, hang the work at its real size, publish it — a collector anywhere in the world walks through it.",
        },
        {
          heading: "Documents that follow the work",
          text: "A certificate of authenticity for every sale, printed from the work itself.",
        },
      ]}
    />
  );
}

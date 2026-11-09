import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Collectors: Lakisa Tools",
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
      title="forCollectors"
      eyebrow="forCollectorsEyebrow"
      description="forCollectorsDesc"
      points={[
        {
          heading: "forCollectorsP1h",
          text: "forCollectorsP1t",
        },
        {
          heading: "forCollectorsP2h",
          text: "forCollectorsP2t",
        },
        {
          heading: "forCollectorsP3h",
          text: "forCollectorsP3t",
        },
        {
          heading: "forCollectorsP4h",
          text: "forCollectorsP4t",
        },
      ]}
    />
  );
}

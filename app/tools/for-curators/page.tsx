import { redirect } from "next/navigation";
import AudiencePage from "@/components/audience-page";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "For Curators — Lakisa Tools",
  description: "Build exhibitions, and keep the works and the people around them in order.",
};

export default async function ForCuratorsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("for-curators", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <AudiencePage
      user={user}
      exhibitionCount={exhibitionCount}
      title="forCurators"
      eyebrow="forCuratorsEyebrow"
      description="forCuratorsDesc"
      points={[
        {
          heading: "forCuratorsP1h",
          text: "forCuratorsP1t",
        },
        {
          heading: "forCuratorsP2h",
          text: "forCuratorsP2t",
        },
        {
          heading: "forCuratorsP3h",
          text: "forCuratorsP3t",
        },
        {
          heading: "forCuratorsP4h",
          text: "forCuratorsP4t",
        },
      ]}
    />
  );
}

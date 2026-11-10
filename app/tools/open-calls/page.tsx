import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import OpenCallsTool from "@/components/open-calls-tool";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Open Calls: Lakisa Tools",
  description:
    "Create an open call, build its application form, publish the public link, and read the responses.",
};

export default async function OpenCallsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("open-calls", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="openCalls"
      eyebrow="openCallsEyebrow"
      description="openCallsDesc"
    >
      <OpenCallsTool />
    </ToolsShell>
  );
}

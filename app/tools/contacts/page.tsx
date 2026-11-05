import { redirect } from "next/navigation";
import ContactsTool from "@/components/contacts-tool";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Contacts — SANAA Tools",
  description: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
};

export default async function ContactsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Contacts"
      eyebrow="TOOLS · CONTACTS & RELATIONSHIPS"
      description="The people around your work — collectors, curators, galleries, advisors. Keep them in one place, with a note on how you met and what they care about."
    >
      <ContactsTool />
    </ToolsShell>
  );
}

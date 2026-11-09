import { redirect } from "next/navigation";
import ContactsTool from "@/components/contacts-tool";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Contacts: Lakisa Tools",
  description: "Collectors, curators, galleries and advisors, who they are and how to reach them.",
};

export default async function ContactsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("contacts", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="contacts"
      eyebrow="contactsEyebrow"
      description="contactsDesc"
    >
      <ContactsTool />
    </ToolsShell>
  );
}

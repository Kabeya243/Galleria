import { redirect } from "next/navigation";
import MessagesThread from "@/components/messages-thread";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Conversation: Lakisa",
  description: "A private conversation on Lakisa.",
};

export default async function MessageThreadRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const ownExhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return <MessagesThread conversationId={id} user={user} ownExhibitionCount={ownExhibitionCount} />;
}

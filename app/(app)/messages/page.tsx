import { redirect } from "next/navigation";
import MessagesInbox from "@/components/messages-inbox";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Messages: Lakisa",
  description: "Private conversations with other people on Lakisa, and inquiries about exhibitions and artworks.",
};

export default async function MessagesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ownExhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return <MessagesInbox user={user} ownExhibitionCount={ownExhibitionCount} />;
}

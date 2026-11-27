import { redirect } from "next/navigation";
import MessagesCompose from "@/components/messages-compose";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "New message: Lakisa",
  description: "Write to another person on Lakisa, or ask the owner of an exhibition or artwork a question.",
};

// Compose a message: the recipient and the inquiry context come from
// the query string (?to=<userId>&exhibitionId=<id>&artworkId=<id>).
// The page resolves them to names so the visitor sees who they are
// writing to; the API re-validates everything on send.
export default async function MessagesNewRoute({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; exhibitionId?: string; artworkId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { to, exhibitionId, artworkId } = await searchParams;

  const [recipient, exhibition, artwork, ownExhibitionCount] = await Promise.all([
    to && to !== user.id
      ? db.user.findUnique({ where: { id: to }, select: { id: true, name: true } })
      : Promise.resolve(null),
    exhibitionId
      ? db.exhibition.findUnique({ where: { id: exhibitionId }, select: { id: true, title: true } })
      : Promise.resolve(null),
    artworkId
      ? db.artwork.findUnique({ where: { id: artworkId }, select: { id: true, title: true, exhibitionId: true } })
      : Promise.resolve(null),
    db.exhibition.count({ where: { ownerId: user.id } }),
  ]);

  return (
    <MessagesCompose
      recipient={recipient}
      exhibition={exhibition}
      artwork={artwork}
      user={user}
      ownExhibitionCount={ownExhibitionCount}
    />
  );
}

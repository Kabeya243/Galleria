import { redirect } from "next/navigation";
import Editor from "@/components/editor";
import { getCurrentUser } from "@/lib/auth";
import { getGalleryNames } from "@/lib/gallery-names-server";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";

export default async function ExhibitionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getCurrentUser())) redirect("/login");
  const { id } = await params;
  // Templates the owner hid in the admin are not offered as a gallery
  // choice in the editor (the room's own layout always stays available).
  const hiddenLayouts = await getHiddenRoomLayouts();
  // Gallery names (English + French, admin overrides included) — the
  // editor shows them in the visitor's language.
  const galleryNames = await getGalleryNames();
  return <Editor exhibitionId={id} hiddenLayouts={hiddenLayouts} galleryNames={galleryNames} />;
}

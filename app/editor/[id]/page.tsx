import { redirect } from "next/navigation";
import Editor from "@/components/editor";
import { getCurrentUser } from "@/lib/auth";
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
  return <Editor exhibitionId={id} hiddenLayouts={hiddenLayouts} />;
}

import { redirect } from "next/navigation";
import Editor from "@/components/editor";
import { getCurrentUser } from "@/lib/auth";

export default async function ExhibitionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getCurrentUser())) redirect("/login");
  const { id } = await params;
  return <Editor exhibitionId={id} />;
}

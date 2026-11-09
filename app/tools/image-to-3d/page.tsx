import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import ImageTo3D from "@/components/image-to-3d";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Image-to-3D & Asset Library: Lakisa Tools",
  description:
    "Your personal 3D asset library with licences and attribution, .glb/.gltf import with a Three.js preview, and honest image-to-3D: 2D textures and depth approximations that run in the browser, with documented slots for external reconstruction services.",
};

export default async function ImageTo3DRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("image-to-3d", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="imageTo3d"
      eyebrow="imageTo3dEyebrow"
      description="imageTo3dDesc"
    >
      <ImageTo3D />
    </ToolsShell>
  );
}

import { redirect } from "next/navigation";

// Frame Studio moved into the merged tool "Frames & Art on Walls".
// Old links keep working: this route redirects there, keeping a
// deep-linked artwork when one was given.
export default async function FrameStudioRedirect({
  searchParams,
}: {
  searchParams: Promise<{ artworkId?: string }>;
}) {
  const { artworkId } = await searchParams;
  redirect(
    artworkId
      ? `/tools/frames-walls?artworkId=${encodeURIComponent(artworkId)}`
      : "/tools/frames-walls",
  );
}

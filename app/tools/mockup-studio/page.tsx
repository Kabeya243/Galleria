import { redirect } from "next/navigation";

// Mockup Studio moved into the merged tool "Frames & Art on Walls".
// Old links keep working: this route redirects there, opening the
// Art on Walls view, and keeping a deep-linked artwork when given.
export default async function MockupStudioRedirect({
  searchParams,
}: {
  searchParams: Promise<{ artworkId?: string }>;
}) {
  const { artworkId } = await searchParams;
  redirect(
    artworkId
      ? `/tools/frames-walls?view=walls&artworkId=${encodeURIComponent(artworkId)}`
      : "/tools/frames-walls?view=walls",
  );
}

import { redirect } from "next/navigation";

// Visitor Analytics moved to the dashboard (Nov 2026): the full
// analytics (visits, unique visitors, most viewed artworks, devices,
// sources, countries, CSV export) now live on the dashboard under
// #visitor-analytics. Old links land there, keeping ?exhibitionId=
// when one was given.
export default async function VisitorAnalyticsRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const { exhibitionId } = await searchParams;
  redirect(
    exhibitionId
      ? `/?exhibitionId=${encodeURIComponent(exhibitionId)}#visitor-analytics`
      : "/#visitor-analytics",
  );
}

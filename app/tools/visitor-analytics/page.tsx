import { redirect } from "next/navigation";

// Visitor Analytics moved to their own dashboard page (Nov 2026):
// the full analytics (visits, unique visitors, most viewed artworks,
// devices, sources, countries, CSV export) now live on
// /dashboard/analytics. Old links land there, keeping ?exhibitionId=
// when one was given.
export default async function VisitorAnalyticsRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const { exhibitionId } = await searchParams;
  redirect(
    exhibitionId
      ? `/dashboard/analytics?exhibitionId=${encodeURIComponent(exhibitionId)}`
      : "/dashboard/analytics",
  );
}

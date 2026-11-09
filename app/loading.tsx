// Route loading fallback (App Router): shown while a route segment
// loads, on the first paint and on navigation. The animated Lakisa
// cube alone on the page background, so a slow route never looks blank.
import LakisaLoader from "@/components/lakisa-loader";

export default function Loading() {
  return <LakisaLoader size="lg" fullscreen />;
}

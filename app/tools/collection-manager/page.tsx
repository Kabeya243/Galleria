import { redirect } from "next/navigation";

// Collection Manager merged into Inventory (Nov 2026): one tool,
// "Inventory & Collections", at /tools/inventory. Old links land there.
export default async function CollectionManagerRoute() {
  redirect("/tools/inventory");
}

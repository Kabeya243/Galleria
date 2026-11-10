import { redirect } from "next/navigation";

// Removed from the tools hub (Nov 2026): this tool is not available
// for now. Old links land on the tools hub instead of breaking.
export default async function RemovedToolRoute() {
  redirect("/tools");
}

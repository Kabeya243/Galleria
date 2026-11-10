import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin";
import { getAllPlans } from "@/lib/subscriptions";

// Admin: every plan, including inactive ones, cheapest first. Readers
// need subscriptions.view. The plans are the rows the manager edits;
// the seed defaults live in lib/subscriptions.ts.
export async function GET() {
  const access = await requireAdminPermission("subscriptions.view");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const plans = await getAllPlans();
  return NextResponse.json({ plans });
}

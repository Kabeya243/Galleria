import { NextResponse } from "next/server";
import { getActivePlans } from "@/lib/subscriptions";

// Public plans list for the pricing page: the active plans, cheapest
// first. No sign-in needed: prices are public.
export async function GET() {
  const plans = await getActivePlans();
  return NextResponse.json({ plans });
}

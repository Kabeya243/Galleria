import { NextResponse } from "next/server";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";

// Public: which room templates the owner hid in the admin panel, so
// client components that list templates (creation dialog) can filter
// them out. The list itself is not sensitive.
export async function GET() {
  const hidden = await getHiddenRoomLayouts();
  return NextResponse.json({ hidden });
}

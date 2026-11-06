import { db } from "@/lib/db";

// Layout ids the owner hid from the admin panel. Templates live in code
// (lib/rooms.ts); this table only records which ones are masked, so the
// hiding survives reloads and redeploys. Hidden templates are filtered
// out wherever templates are listed.
export async function getHiddenRoomLayouts(): Promise<string[]> {
  try {
    const rows = await db.hiddenRoomTemplate.findMany({ select: { layout: true } });
    return rows.map((row) => row.layout);
  } catch {
    // The table does not exist yet (first deploy before `prisma db push`
    // creates it): treat nothing as hidden instead of breaking the page.
    return [];
  }
}

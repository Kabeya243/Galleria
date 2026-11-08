// Tool-document archive — the R2 file copy behind every document tool's
// database save.
//
// Every document tool (certificates, presentations, exhibition plans,
// marketing assets, print jobs, art-in-context projects) already saves
// its configuration in the database via /api/saved-work (SavedWork rows,
// user-scoped). This module adds the second half of the Atelier pattern:
// the same document is also stored as a JSON file in the « sanaa » R2
// bucket, under a user-scoped key, exactly like Atelier designs live at
// atelier/projects/<userId>/<id>.json (see app/api/atelier/projects).
//
//   certificates/<userId>/<id>.json          — certificates of authenticity
//   tool-archives/<kind>/<userId>/<id>.json  — the other document tools
//
// The database row stays the source of truth for the on-screen lists
// (open / reprint / revoke); the R2 file is the durable archive copy in
// the user's account. Archiving is best-effort: when R2 is not
// configured the route answers 501 and the caller keeps the database
// save, saying so inline — never window.alert, never a failed save.

export type ArchiveKind =
  | "certificate"
  | "presentation"
  | "exhibition-plan"
  | "marketing-asset"
  | "print-job"
  | "context-project";

export type ArchiveResult = { archived: boolean; reason?: string };

export async function archiveToolDocument(
  kind: ArchiveKind,
  id: string,
  data: Record<string, unknown>,
): Promise<ArchiveResult> {
  try {
    const res = await fetch("/api/tool-archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, data }),
    });
    if (res.status === 501) return { archived: false, reason: "archive-unavailable" };
    if (!res.ok) return { archived: false, reason: "archive-failed" };
    return { archived: true };
  } catch {
    return { archived: false, reason: "archive-failed" };
  }
}

export async function deleteToolArchive(kind: ArchiveKind, id: string): Promise<void> {
  try {
    await fetch(`/api/tool-archives?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // Best-effort: the database row is already gone, the archive copy is
    // harmless if it lingers (it is user-scoped and never listed alone).
  }
}

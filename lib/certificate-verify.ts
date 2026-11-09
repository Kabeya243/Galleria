// Public certificate verification (Lakisa, November 2026).
//
// Certificates are SavedWork rows of kind "certificate"; the full
// CertificateConfig lives in the row's `data` JSON, including the
// certificateId (LAKISA-YYYY-XXXX for new ones, SANAA-YYYY-XXXX for
// older ones — both stay verifiable, the lookup is by ID, not prefix).
// This lookup is shared by the public API route
// (/api/verify-certificate) and the public page (/verify): it is
// read-only, needs no sign-in, and never invents a certificate —
// an unknown ID returns null.

import { db } from "@/lib/db";

export type VerifiedCertificate = {
  certificateId: string;
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
  year: string;
  editionNumber: string;
  editionSize: string;
  issueDate: string;
  issuedAt: string;
  imageUrl: string | null;
};

/** Normalise a certificate ID for lookup: trimmed, upper case. */
export function normalizeCertificateId(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Public verification URL for a certificate ID on this deployment. */
export function certificateVerifyUrl(certificateId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/verify?id=${encodeURIComponent(normalizeCertificateId(certificateId))}`;
}

function pickString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

/** Find a certificate by ID across all issuers. Returns null when unknown. */
export async function findCertificateById(rawId: string): Promise<VerifiedCertificate | null> {
  const id = normalizeCertificateId(rawId);
  if (!id || id.length > 100) return null;
  const rows = await db.savedWork.findMany({
    where: { kind: "certificate" },
    select: { data: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      continue;
    }
    const certificateId = pickString(data, "certificateId");
    if (!certificateId || normalizeCertificateId(certificateId) !== id) continue;
    const editionSize = pickString(data, "editionSize") || "1";
    return {
      certificateId,
      title: pickString(data, "title"),
      artist: pickString(data, "artist"),
      medium: pickString(data, "medium"),
      dimensions: pickString(data, "dimensions"),
      year: pickString(data, "year"),
      editionNumber: pickString(data, "editionNumber") || "1",
      editionSize,
      issueDate: pickString(data, "issueDate"),
      issuedAt: row.createdAt.toISOString(),
      imageUrl: typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? (data.imageUrl as string) : null,
    };
  }
  return null;
}

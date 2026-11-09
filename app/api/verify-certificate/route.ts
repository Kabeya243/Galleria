import { NextResponse } from "next/server";
import { findCertificateById, normalizeCertificateId } from "@/lib/certificate-verify";

// Public certificate verification (read-only, no sign-in).
// GET /api/verify-certificate?id=LAKISA-2026-XXXX
// Returns { found: true, certificate } or { found: false } (404).
// The lookup is by certificate ID across all issuers, so both new
// LAKISA-… IDs and older SANAA-… IDs verify. Nothing is modified.

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const normalized = normalizeCertificateId(id);
  if (!normalized) {
    return NextResponse.json({ found: false, error: "Enter a certificate ID." }, { status: 400 });
  }
  try {
    const certificate = await findCertificateById(normalized);
    if (!certificate) {
      return NextResponse.json({ found: false }, { status: 404 });
    }
    return NextResponse.json({ found: true, certificate });
  } catch (error) {
    console.error("Certificate verification failed.", error);
    return NextResponse.json({ found: false, error: "Verification is unavailable right now." }, { status: 500 });
  }
}

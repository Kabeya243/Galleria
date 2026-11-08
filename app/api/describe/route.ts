import { NextResponse } from "next/server";

// Optional richer artwork descriptions (Google Gemini 2.5 Flash).
//
// The route only calls Gemini when GEMINI_API_KEY is set in the
// environment; without it, GET reports available:false and POST answers
// 503. No key is ever created here and none is asked of the user —
// The browser captioning model (lib/caption.ts) is the primary description
// source and works without any key. Gemini is a richer fallback: it
// sees the image and writes a fuller alt-text + description draft,
// still only a proposal the artist validates in the editor.
//
// Gemini's free tier (April 2026, quotas cut in Dec 2025) is 250
// requests/day for 2.5 Flash, 10/minute — ample for describing artworks
// one by one. Free-tier traffic is deprioritised under load (503s
// possible), so the client treats any failure as "keep the caption text".

export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const FETCH_TIMEOUT_MS = 20000;
const MAX_IMAGE_BYTES = 8_000_000;
// Caps for the returned fields (same values as CAPTION_MAX_ALT /
// CAPTION_MAX_DESCRIPTION in lib/caption.ts).
const MAX_ALT = 500;
const MAX_DESCRIPTION = 2000;

// Same artwork URL shapes the save validator accepts (see
// lib/validation.ts): same-origin R2 / uploads / portfolio. Anything
// else is refused, so this route cannot be used to fetch an arbitrary
// URL (no SSRF).
const ALLOWED_IMAGE_URL =
  /^\/(?:api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp)|r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif)))$/i;

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini is not set up on this site yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const imageUrl = (body as { imageUrl?: unknown })?.imageUrl;
  if (typeof imageUrl !== "string" || !ALLOWED_IMAGE_URL.test(imageUrl)) {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  // Fetch the image same-origin (the URL is a path on this site).
  let imageBytes: ArrayBuffer;
  let mimeType = "image/jpeg";
  try {
    const absolute = new URL(imageUrl, request.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(absolute, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`Image fetch answered ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.startsWith("image/")) mimeType = contentType.split(";")[0].trim();
      imageBytes = await res.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ error: "Could not load this image." }, { status: 502 });
  }
  if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "This image is too large to describe." }, { status: 400 });
  }

  // Ask Gemini for a one-sentence alt-text and a two-sentence
  // description draft, in English, as JSON only.
  const prompt =
    `Describe this artwork for a gallery visitor. Reply with JSON only, no other text, no markdown: ` +
    `{"altText": "one short sentence describing what the artwork shows, in English", ` +
    `"description": "a two-sentence description draft for a gallery visitor, in English, starting with 'This work shows'"}.`;
  let geminiText: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: Buffer.from(imageBytes).toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Gemini answered ${res.status}`);
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
      };
      geminiText =
        json.candidates?.[0]?.content?.parts
          ?.map((part) => (typeof part.text === "string" ? part.text : ""))
          .join("") ?? "";
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json(
      { error: "Gemini did not answer. Try again later." },
      { status: 502 },
    );
  }

  // Gemini may wrap the JSON in a markdown code fence — strip it.
  const cleaned = geminiText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed: { altText?: unknown; description?: unknown };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    return NextResponse.json(
      { error: "Gemini returned an unreadable answer." },
      { status: 502 },
    );
  }
  if (typeof parsed.altText !== "string" || typeof parsed.description !== "string") {
    return NextResponse.json(
      { error: "Gemini returned an unreadable answer." },
      { status: 502 },
    );
  }
  const altText = parsed.altText.trim().slice(0, MAX_ALT);
  const description = parsed.description.trim().slice(0, MAX_DESCRIPTION);
  if (!altText || !description) {
    return NextResponse.json(
      { error: "Gemini returned an empty description." },
      { status: 502 },
    );
  }
  return NextResponse.json({ altText, description, source: "gemini" });
}

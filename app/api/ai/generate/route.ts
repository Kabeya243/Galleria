import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProvider, getProviderStatus } from "@/lib/ai-providers";

// Server-only boundary for model-powered features (Phase 5 AI tools).
// The browser never sees a key: the provider adapter reads its key from
// server env only (GEMINI_API_KEY for Gemini, AI_API_KEY otherwise).
// When no provider is configured this route answers 503 with the status,
// so the UI can show "not connected" honestly — it never invents a model
// reply.
//
// Rate limit: 20 requests per user per rolling hour. The Gemini free
// tier is shared by the whole site, so one account must not burn it for
// everyone. The limiter is in-memory per server instance (Vercel runs
// several); Google's own 429 is passed through as well, so the free-tier
// cap is enforced either way.
//
// Image input: an optional imageUrl (same-origin artwork URL only, the
// same allowlist as /api/describe, so this route cannot fetch an
// arbitrary URL). The image is fetched server-side and sent to the
// provider alongside the text prompt.

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  system: z.string().max(2000).optional(),
  maxTokens: z.number().int().min(50).max(2000).optional(),
  imageUrl: z.string().max(2000).optional(),
});

// Same artwork URL shapes the save validator accepts (see
// lib/validation.ts): same-origin R2 / uploads / portfolio. Anything
// else is refused, so this route cannot be used to fetch an arbitrary
// URL (no SSRF).
const ALLOWED_IMAGE_URL =
  /^\/(?:api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp)|r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif)))$/i;

const FETCH_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 8_000_000;

const RATE_LIMIT_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateLimits = new Map<string, { count: number; windowStart: number }>();

function rateLimitExceeded(userId: string): { exceeded: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateLimits.set(userId, { count: 1, windowStart: now });
    return { exceeded: false, retryAfterSeconds: 0 };
  }
  if (entry.count >= RATE_LIMIT_PER_HOUR) {
    return {
      exceeded: true,
      retryAfterSeconds: Math.ceil((entry.windowStart + RATE_WINDOW_MS - now) / 1000),
    };
  }
  entry.count += 1;
  return { exceeded: false, retryAfterSeconds: 0 };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  const limited = rateLimitExceeded(user.id);
  if (limited.exceeded) {
    return NextResponse.json(
      { error: "Too many AI requests. Please try again later.", retryAfterSeconds: limited.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const status = getProviderStatus();
  if (!status.configured) {
    return NextResponse.json(
      {
        error: "No AI provider is connected.",
        provider: status.id,
        missingVars: status.missingVars,
        setupHint: status.setupHint,
      },
      { status: 503 },
    );
  }

  const provider = getProvider();
  if (!provider) {
    return NextResponse.json({ error: "No AI provider is connected." }, { status: 503 });
  }

  // Optional image: fetch it server-side (same-origin only) and pass it
  // to the provider alongside the text prompt.
  let image: { base64: string; mimeType: string } | undefined;
  if (parsed.data.imageUrl) {
    if (!ALLOWED_IMAGE_URL.test(parsed.data.imageUrl)) {
      return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
    }
    try {
      const absolute = new URL(parsed.data.imageUrl, request.url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let imageBytes: ArrayBuffer;
      let mimeType = "image/jpeg";
      try {
        const res = await fetch(absolute, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`Image fetch answered ${res.status}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) mimeType = contentType.split(";")[0].trim();
        imageBytes = await res.arrayBuffer();
      } finally {
        clearTimeout(timer);
      }
      if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "This image is too large." }, { status: 400 });
      }
      image = { base64: Buffer.from(imageBytes).toString("base64"), mimeType };
    } catch {
      return NextResponse.json({ error: "Could not load this image." }, { status: 502 });
    }
  }

  try {
    const result = await provider.generateText(
      [
        ...(parsed.data.system ? [{ role: "system" as const, content: parsed.data.system }] : []),
        { role: "user" as const, content: parsed.data.prompt },
      ],
      { maxTokens: parsed.data.maxTokens ?? 800, ...(image ? { image } : {}) },
    );
    return NextResponse.json({
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: result.usage ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider request failed.";
    // Pass the provider's own rate limit through honestly.
    if (/\(429\)/.test(message)) {
      return NextResponse.json({ error: "The AI service is busy. Please try again in a minute." }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

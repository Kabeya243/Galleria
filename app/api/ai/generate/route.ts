import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProvider, getProviderStatus } from "@/lib/ai-providers";

// Server-only boundary for model-powered features (Phase 5 AI tools).
// The browser never sees a key: the provider adapter reads AI_API_KEY
// from server env only. When no provider is configured this route answers
// 503 with the status, so the UI can show "not connected" honestly —
// it never invents a model reply.

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  system: z.string().max(2000).optional(),
  maxTokens: z.number().int().min(50).max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

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

  try {
    const result = await provider.generateText(
      [
        ...(parsed.data.system ? [{ role: "system" as const, content: parsed.data.system }] : []),
        { role: "user" as const, content: parsed.data.prompt },
      ],
      { maxTokens: parsed.data.maxTokens ?? 800 },
    );
    return NextResponse.json({
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: result.usage ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

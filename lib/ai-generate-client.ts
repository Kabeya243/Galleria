// Client helper for POST /api/ai/generate (Phase 5 AI tools).
//
// Both AI tools in the UI (price suggestion, social texts) call the same
// route, so the fetch and the honest error mapping live here once.
// Nothing is invented: a 503 means no provider is connected, a 429
// means the limit was hit, and any other failure is reported as a
// failure, never replaced with a made-up reply.

export type AiGenerateReply = {
  text: string;
  model: string;
  provider: string;
};

/** Map a generate-route failure to a plain sentence for the UI. */
export function aiErrorMessage(status: number, serverError?: string): string {
  if (status === 503) return "AI is not connected yet. No suggestion was made.";
  if (status === 429) return "Too many AI requests. Wait a little and try again.";
  if (status === 401) return "Sign in to use AI features.";
  if (status === 502) return "The AI provider failed. Try again.";
  return serverError || "The AI request failed. Try again.";
}

export async function callAiGenerate(input: {
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<AiGenerateReply> {
  let res: Response;
  try {
    res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("The AI request could not be sent. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as {
    text?: string;
    model?: string;
    provider?: string;
    error?: string;
  } | null;
  if (res.ok && typeof data?.text === "string" && data.text.trim()) {
    return { text: data.text, model: data.model ?? "", provider: data.provider ?? "" };
  }
  throw new Error(aiErrorMessage(res.status, data?.error));
}

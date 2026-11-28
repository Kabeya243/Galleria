// ---------------------------------------------------------------------------
// AI provider boundary for SANAA — Phase 5.
//
// There is NO AI service connected to SANAA by default. This module is the
// single integration boundary between the tools and any language model:
//
//   * `getProviderStatus()` — server-side only. Reads configuration from
//     environment variables and reports whether a provider is usable. It
//     NEVER returns a key, token or any secret value.
//   * `getProvider()` — returns a provider adapter, or `null` when none is
//     configured. Tools call the model only through this adapter, and only
//     from server code (see app/api/ai/generate/route.ts).
//   * `AiProvider` — the adapter interface. A new provider is added by
//     implementing this interface and registering it in `getProvider()`.
//
// REQUIRED ENVIRONMENT VARIABLES (set them on the server / in Vercel —
// never commit them, never paste them into the UI):
//
//   AI_PROVIDER      "openai" | "anthropic" | "openai-compatible" | "gemini" | "none"
//                    (default: "none" — no provider, model features off.
//                    When AI_PROVIDER is unset and GEMINI_API_KEY is
//                    present, Gemini is selected automatically, so Kabeya
//                    only has to add the one key in Vercel.)
//   AI_API_KEY       Secret key for the provider. Read only on the server.
//   AI_MODEL         Model name, e.g. "gpt-4o-mini" or
//                    "claude-sonnet-4-5-20250929". Defaults per provider.
//   AI_BASE_URL      Only for "openai-compatible": the chat-completions
//                    base URL of the provider, e.g.
//                    "https://api.example.com/v1".
//   GEMINI_API_KEY   Google AI Studio key (free tier) for the Gemini
//                    provider. Read only on the server.
//   GEMINI_MODEL     Gemini model name, e.g. "gemini-3.5-flash"
//                    (default).
//
// Until these are set, every model-powered feature in the tools shows
// "needs an AI provider — not connected" and stays disabled. Nothing in
// SANAA pretends a model answered when it did not.
// ---------------------------------------------------------------------------

export type AiProviderId = "none" | "openai" | "anthropic" | "openai-compatible" | "gemini";

export type AiProviderStatus = {
  /** Which provider is selected by AI_PROVIDER (or "none"). */
  id: AiProviderId;
  /** Human label for the UI. */
  label: string;
  /** True only when every variable the provider needs is present. */
  configured: boolean;
  /** Env vars still missing before this provider can be used. */
  missingVars: string[];
  /** Model that would be used (default when AI_MODEL is unset). */
  model: string;
  /** Base URL for openai-compatible providers. */
  baseUrl?: string;
  /** Short setup hint shown in the settings panel. */
  setupHint: string;
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiGenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  /** Optional image (base64) sent alongside the text prompt. */
  image?: { base64: string; mimeType: string };
};

export type AiGenerateResult = {
  text: string;
  model: string;
  provider: AiProviderId;
  /** Token counts when the provider reports them. */
  usage?: { inputTokens?: number; outputTokens?: number };
};

export interface AiProvider {
  readonly id: Exclude<AiProviderId, "none">;
  readonly label: string;
  readonly model: string;
  generateText(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult>;
}

const DEFAULT_MODELS: Record<Exclude<AiProviderId, "none">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  "openai-compatible": "gpt-4o-mini",
  gemini: "gemini-3.5-flash",
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  none: "No provider",
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compatible": "OpenAI-compatible endpoint",
  gemini: "Google Gemini",
};

const SETUP_HINTS: Record<AiProviderId, string> = {
  none: "Set GEMINI_API_KEY to a Google AI Studio API key (free tier), or set AI_PROVIDER to openai, anthropic or openai-compatible, then add AI_API_KEY (and AI_MODEL if you want a specific model).",
  openai: "Set AI_API_KEY to an OpenAI API key. Optionally set AI_MODEL (default gpt-4o-mini).",
  anthropic:
    "Set AI_API_KEY to an Anthropic API key. Optionally set AI_MODEL (default claude-sonnet-4-5-20250929).",
  "openai-compatible":
    "Set AI_API_KEY, AI_BASE_URL (the provider's /v1 chat-completions URL) and AI_MODEL.",
  gemini: "Set GEMINI_API_KEY to a Google AI Studio API key (free tier). Optionally set GEMINI_MODEL (default gemini-3.5-flash).",
};

function readProviderId(): AiProviderId {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "openai" || raw === "anthropic" || raw === "openai-compatible" || raw === "gemini") return raw;
  // Gemini is the default when its key is present and no provider is
  // chosen: Kabeya only has to add GEMINI_API_KEY in Vercel.
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return "none";
}

/** Server-side only: inspects env config and reports provider status. No secrets are ever returned. */
export function getProviderStatus(): AiProviderStatus {
  const id = readProviderId();
  const model =
    (id === "gemini"
      ? process.env.GEMINI_MODEL?.trim() || process.env.AI_MODEL?.trim()
      : process.env.AI_MODEL?.trim()) ||
    DEFAULT_MODELS[id as Exclude<AiProviderId, "none">] ||
    "";
  const baseUrl = process.env.AI_BASE_URL?.trim() || undefined;
  const missingVars: string[] = [];
  if (id === "none") {
    missingVars.push("GEMINI_API_KEY");
  } else if (id === "gemini") {
    if (!process.env.GEMINI_API_KEY?.trim()) missingVars.push("GEMINI_API_KEY");
  } else {
    if (!process.env.AI_API_KEY?.trim()) missingVars.push("AI_API_KEY");
    if (id === "openai-compatible" && !baseUrl) missingVars.push("AI_BASE_URL");
  }
  return {
    id,
    label: PROVIDER_LABELS[id],
    configured: id !== "none" && missingVars.length === 0,
    missingVars,
    model,
    baseUrl,
    setupHint: SETUP_HINTS[id],
  };
}

function requireKey(): string {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) throw new Error("AI_API_KEY is not set.");
  return key;
}

function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return key;
}

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/** OpenAI chat-completions adapter. Also used for openai-compatible endpoints with a custom base URL. */
class OpenAiCompatibleProvider implements AiProvider {
  readonly id: Exclude<AiProviderId, "none">;
  readonly label: string;
  readonly model: string;
  private readonly baseUrl: string;

  constructor(id: "openai" | "openai-compatible", model: string, baseUrl?: string) {
    this.id = id;
    this.label = PROVIDER_LABELS[id];
    this.model = model;
    this.baseUrl = (baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async generateText(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    const key = requireKey();
    const { signal, clear } = timeoutSignal(60_000);
    // Image input (when provided): attach it to the last user message
    // as an image_url data URL, alongside its text.
    const requestMessages: unknown[] = messages.map((m) => ({ role: m.role, content: m.content }));
    if (options?.image) {
      const dataUrl = `data:${options.image.mimeType};base64,${options.image.base64}`;
      for (let i = requestMessages.length - 1; i >= 0; i--) {
        const entry = requestMessages[i] as { role: string; content: unknown };
        if (entry.role === "user") {
          entry.content = [
            { type: "text", text: typeof entry.content === "string" ? entry.content : "" },
            { type: "image_url", image_url: { url: dataUrl } },
          ];
          break;
        }
      }
    }
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: requestMessages,
          max_tokens: options?.maxTokens ?? 800,
          temperature: options?.temperature ?? 0.7,
        }),
        signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Provider request failed (${res.status}). ${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("Provider returned an empty reply.");
      return {
        text,
        model: this.model,
        provider: this.id,
        usage: json.usage
          ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
          : undefined,
      };
    } finally {
      clear();
    }
  }
}

/** Anthropic messages adapter. */
class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  readonly label = PROVIDER_LABELS.anthropic;
  readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  async generateText(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    const key = requireKey();
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const { signal, clear } = timeoutSignal(60_000);
    // Image input (when provided): attach it to the last user message
    // as an image content block, before its text.
    const requestMessages: unknown[] = rest.map((m) => ({ role: m.role, content: m.content }));
    if (options?.image) {
      for (let i = requestMessages.length - 1; i >= 0; i--) {
        const entry = requestMessages[i] as { role: string; content: unknown };
        if (entry.role === "user") {
          entry.content = [
            {
              type: "image",
              source: { type: "base64", media_type: options.image.mimeType, data: options.image.base64 },
            },
            { type: "text", text: typeof entry.content === "string" ? entry.content : "" },
          ];
          break;
        }
      }
    }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options?.maxTokens ?? 800,
          temperature: options?.temperature ?? 0.7,
          ...(system ? { system } : {}),
          messages: requestMessages,
        }),
        signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Provider request failed (${res.status}). ${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        content?: { type?: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = (json.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Provider returned an empty reply.");
      return {
        text,
        model: this.model,
        provider: "anthropic",
        usage: json.usage
          ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }
          : undefined,
      };
    } finally {
      clear();
    }
  }
}

/** Google Gemini adapter (native REST API). Reads GEMINI_API_KEY.
 * The free tier is rate limited by Google; a 429 from the provider is
 * passed through as an error, never hidden. Image input is sent as
 * inlineData, the same shape the /api/describe route uses. */
class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly label = PROVIDER_LABELS.gemini;
  readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  async generateText(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    const key = requireGeminiKey();
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const userText = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
    const { signal, clear } = timeoutSignal(60_000);
    try {
      const parts: unknown[] = [];
      if (options?.image) {
        parts.push({ inlineData: { mimeType: options.image.mimeType, data: options.image.base64 } });
      }
      parts.push({ text: userText });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxTokens ?? 800,
            },
          }),
          signal,
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Provider request failed (${res.status}). ${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Provider returned an empty reply.");
      return {
        text,
        model: this.model,
        provider: "gemini",
        usage: json.usageMetadata
          ? { inputTokens: json.usageMetadata.promptTokenCount, outputTokens: json.usageMetadata.candidatesTokenCount }
          : undefined,
      };
    } finally {
      clear();
    }
  }
}

/**
 * Returns the configured provider adapter, or `null` when no provider is
 * connected. Callers must handle `null` by showing the "not connected"
 * state — never by faking a model reply.
 */
export function getProvider(): AiProvider | null {
  const status = getProviderStatus();
  if (!status.configured) return null;
  if (status.id === "gemini") return new GeminiProvider(status.model);
  if (status.id === "anthropic") return new AnthropicProvider(status.model);
  if (status.id === "openai") return new OpenAiCompatibleProvider("openai", status.model);
  if (status.id === "openai-compatible")
    return new OpenAiCompatibleProvider("openai-compatible", status.model, status.baseUrl);
  return null;
}

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
//   AI_PROVIDER      "openai" | "anthropic" | "openai-compatible" | "none"
//                    (default: "none" — no provider, model features off)
//   AI_API_KEY       Secret key for the provider. Read only on the server.
//   AI_MODEL         Model name, e.g. "gpt-4o-mini" or
//                    "claude-sonnet-4-5-20250929". Defaults per provider.
//   AI_BASE_URL      Only for "openai-compatible": the chat-completions
//                    base URL of the provider, e.g.
//                    "https://api.example.com/v1".
//
// Until these are set, every model-powered feature in the tools shows
// "needs an AI provider — not connected" and stays disabled. Nothing in
// SANAA pretends a model answered when it did not.
// ---------------------------------------------------------------------------

export type AiProviderId = "none" | "openai" | "anthropic" | "openai-compatible";

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
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  none: "No provider",
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compatible": "OpenAI-compatible endpoint",
};

const SETUP_HINTS: Record<AiProviderId, string> = {
  none: "Set AI_PROVIDER to openai, anthropic or openai-compatible, then add AI_API_KEY (and AI_MODEL if you want a specific model).",
  openai: "Set AI_API_KEY to an OpenAI API key. Optionally set AI_MODEL (default gpt-4o-mini).",
  anthropic:
    "Set AI_API_KEY to an Anthropic API key. Optionally set AI_MODEL (default claude-sonnet-4-5-20250929).",
  "openai-compatible":
    "Set AI_API_KEY, AI_BASE_URL (the provider's /v1 chat-completions URL) and AI_MODEL.",
};

function readProviderId(): AiProviderId {
  const raw = (process.env.AI_PROVIDER ?? "none").trim().toLowerCase();
  if (raw === "openai" || raw === "anthropic" || raw === "openai-compatible") return raw;
  return "none";
}

/** Server-side only: inspects env config and reports provider status. No secrets are ever returned. */
export function getProviderStatus(): AiProviderStatus {
  const id = readProviderId();
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[id as Exclude<AiProviderId, "none">] || "";
  const baseUrl = process.env.AI_BASE_URL?.trim() || undefined;
  const missingVars: string[] = [];
  if (id === "none") {
    missingVars.push("AI_PROVIDER");
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
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
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
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
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

/**
 * Returns the configured provider adapter, or `null` when no provider is
 * connected. Callers must handle `null` by showing the "not connected"
 * state — never by faking a model reply.
 */
export function getProvider(): AiProvider | null {
  const status = getProviderStatus();
  if (!status.configured) return null;
  if (status.id === "anthropic") return new AnthropicProvider(status.model);
  if (status.id === "openai") return new OpenAiCompatibleProvider("openai", status.model);
  if (status.id === "openai-compatible")
    return new OpenAiCompatibleProvider("openai-compatible", status.model, status.baseUrl);
  return null;
}

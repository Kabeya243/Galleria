"use client";

import type { CSSProperties } from "react";
import type { AiProviderStatus } from "@/lib/ai-providers";

// ---------------------------------------------------------------------------
// ProviderPanel — the shared "AI provider" settings panel for the Phase 5
// AI tools. It tells the truth: when no provider is configured it says so
// plainly, lists the env vars to set, and explains how to connect. It never
// shows a key and never pretends a model is answering.
// ---------------------------------------------------------------------------

const S: Record<string, CSSProperties> = {
  panel: {
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "16px 18px",
    background: "var(--surface-3, #fff)",
    marginBottom: 28,
  },
  title: {
    margin: "0 0 6px",
    fontFamily: "var(--font-display), Georgia, serif",
    fontSize: 17,
    fontWeight: 600,
  },
  text: { margin: "0 0 8px", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10,
  },
  code: {
    display: "block",
    padding: "12px 14px",
    borderRadius: 8,
    background: "#141414",
    color: "#f5f2eb",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    margin: "8px 0",
  },
  list: { margin: "6px 0 8px", paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "var(--muted)" },
};

export default function ProviderPanel({ status }: { status: AiProviderStatus }) {
  const configured = status.configured;
  return (
    <section style={S.panel} aria-label="AI provider settings">
      <span
        style={{
          ...S.badge,
          background: configured ? "#e7f2e4" : "#fdf3f2",
          color: configured ? "#2e6b34" : "#7b241c",
        }}
      >
        {configured ? `● Connected, ${status.label}` : "● Not connected, no AI provider"}
      </span>
      <h2 style={S.title}>AI provider</h2>
      {configured ? (
        <>
          <p style={S.text}>
            {status.label} is connected{status.model ? ` (model ${status.model})` : ""}. The
            model-powered features below are live. Your API key stays on the server. It is never
            shown or sent to the browser.
          </p>
        </>
      ) : (
        <>
          <p style={S.text}>
            There is no AI service connected to Lakisa right now. Everything on this page that
            works from your own data (your artworks, colours, dimensions, rooms and templates)
            works today. Anything that would need a language model is marked{" "}
            <strong>“needs an AI provider”</strong> and stays off until you connect one.
          </p>
          <p style={S.text}>{status.setupHint}</p>
          <code style={S.code}>
            {`# In your server environment (Vercel → Settings → Environment Variables):
AI_PROVIDER=openai            # or anthropic, or openai-compatible
AI_API_KEY=your-secret-key    # never commit this
AI_MODEL=gpt-4o-mini          # optional, a default is used otherwise
# AI_BASE_URL=…               # only for openai-compatible endpoints`}
          </code>
          {status.missingVars.length > 0 && (
            <p style={S.text}>
              Still missing: <strong>{status.missingVars.join(", ")}</strong>
            </p>
          )}
          <ul style={S.list}>
            <li>Keys are read only on the server. The browser never receives them.</li>
            <li>After setting the variables, redeploy (Vercel picks them up on the next deploy).</li>
            <li>Model replies are labelled with the provider and model that answered.</li>
          </ul>
        </>
      )}
    </section>
  );
}

/** Short inline notice for a single model-powered feature. */
export function ModelIntegrationNote({ status, feature }: { status: AiProviderStatus; feature: string }) {
  if (status.configured) return null;
  return (
    <p
      style={{
        margin: "8px 0 0",
        padding: "10px 12px",
        border: "1px dashed var(--line)",
        borderRadius: 8,
        background: "var(--room-color)",
        color: "var(--muted)",
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "var(--ink)" }}>Needs an AI provider, not connected.</strong> {feature}{" "}
      would need a language model. Connect a provider in the panel above to switch it on; nothing
      here is a simulated model reply.
    </p>
  );
}

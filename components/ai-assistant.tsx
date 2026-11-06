"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ProviderPanel, { ModelIntegrationNote } from "@/components/ai-provider-panel";
import type { AiProviderStatus } from "@/lib/ai-providers";
import {
  colourName,
  parseDimensions,
  publishReadiness,
  sizeClass,
  suggestFrame,
  type AiArtworkLike,
  type FrameOptionLike,
  type RoomTemplateLike,
} from "@/lib/ai-rules";

// ---------------------------------------------------------------------------
// AI Creative Assistant — a chat panel that answers ONLY from the user's
// actual project data (their exhibitions, artworks, frames, rooms and
// saved work) plus plain rules. Every answer names its source
// ("based on your 8 artworks…"). When a question cannot be answered from
// data + rules, the assistant says so plainly instead of guessing.
// Anything that would need a language model is a labelled integration
// point using the same provider boundary as the other Phase 5 tools.
// ---------------------------------------------------------------------------

export type AssistantExhibition = {
  id: string;
  title: string;
  status: string;
  artworkCount: number;
  rooms: { id: string; name: string; layout: string }[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: string;
  model?: string;
};

const SUGGESTED_QUESTIONS = [
  "Which works are unframed?",
  "What is missing before I can publish?",
  "What fits the White Cube room?",
  "Which works are large?",
  "What rooms do I have?",
  "How many works do I have?",
  "Suggest a frame for my darkest work",
  "Which works have no dimensions?",
];

const S: Record<string, CSSProperties> = {
  section: { marginBottom: 36 },
  sectionTitle: { margin: "0 0 4px", fontFamily: "var(--font-display), Georgia, serif", fontSize: 20, fontWeight: 600 },
  sectionNote: { margin: "0 0 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 },
  chat: {
    border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-3, #fff)",
    padding: "18px", marginBottom: 16,
  },
  messages: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, maxHeight: 520, overflowY: "auto" },
  bubble: {
    maxWidth: "85%", padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
  },
  userBubble: { alignSelf: "flex-end", background: "#141414", color: "#fdfdfc", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", background: "var(--room-color)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 },
  source: { display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)", fontStyle: "italic" },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  chip: {
    padding: "8px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--ink)",
  },
  inputRow: { display: "flex", gap: 10 },
  input: {
    flex: 1, minHeight: 44, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8,
    background: "var(--surface-3, #fff)", color: "var(--ink)", fontSize: 13, fontFamily: "inherit",
  },
  ghostButton: {
    minHeight: 40, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 8,
    background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  status: { margin: "12px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 },
  errorBox: {
    padding: 14, border: "1px solid #c0392b", borderRadius: 10, background: "#fdf3f2",
    color: "#7b241c", fontSize: 13, lineHeight: 1.55,
  },
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiAssistant({
  exhibitions,
  artworks,
  templates,
  frames,
  savedKinds,
  providerStatus,
}: {
  exhibitions: AssistantExhibition[];
  artworks: AiArtworkLike[];
  templates: RoomTemplateLike[];
  frames: FrameOptionLike[];
  savedKinds: string[];
  providerStatus: AiProviderStatus;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "assistant",
      text: `Hello — I can answer questions about your actual work here: your ${artworks.length} artwork${artworks.length === 1 ? "" : "s"}, ${exhibitions.length} exhibition${exhibitions.length === 1 ? "" : "s"} and your rooms and frames. Try one of the suggestions below, or ask in your own words. If I cannot answer from your data, I will say so rather than guess.`,
      source: `Based on your ${artworks.length} artworks and ${exhibitions.length} exhibitions.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const sourceLine = useMemo(
    () => `Based on your ${artworks.length} artwork${artworks.length === 1 ? "" : "s"} and ${exhibitions.length} exhibition${exhibitions.length === 1 ? "" : "s"}.`,
    [artworks.length, exhibitions.length],
  );

  const answerQuestion = useCallback(
    (question: string): { text: string; source: string } | null => {
      const q = question.toLowerCase().trim();
      if (!q) return null;

      // Unframed works
      if (q.includes("unframed") || q.includes("without a frame") || q.includes("no frame")) {
        const unframed = artworks.filter((a) => (a.frame ?? "wood") === "none");
        if (unframed.length === 0) {
          return {
            text: `All ${artworks.length} of your works have a frame set. Nothing is unframed.`,
            source: sourceLine,
          };
        }
        return {
          text: `${unframed.length} work${unframed.length === 1 ? " is" : "s are"} unframed:\n${unframed.map((a) => `• ${a.title}${a.exhibitionTitle ? ` (${a.exhibitionTitle})` : ""}`).join("\n")}\n\nYou can set a frame for each one in Frame Studio.`,
          source: sourceLine,
        };
      }

      // Publish readiness
      if (q.includes("publish") || q.includes("missing") || q.includes("ready")) {
        const issues = publishReadiness(
          exhibitions.map((e) => ({ id: e.id, title: e.title, status: e.status, artworkCount: e.artworkCount })),
          artworks,
          savedKinds,
        );
        if (issues.length === 0) {
          return {
            text: "Nothing is missing that I can see: every exhibition has works, every work has an image, dimensions and a description, and you have a saved concept. You look ready to publish.",
            source: sourceLine,
          };
        }
        return {
          text: `Before publishing, ${issues.length} thing${issues.length === 1 ? " needs" : "s need"} attention:\n${issues.map((i) => `• ${i.label} — ${i.detail}`).join("\n")}`,
          source: sourceLine,
        };
      }

      // What fits a room
      const roomMatch = /what fits (?:the )?(.+?)(?: room)?\?*$/.exec(q);
      if (q.includes("fits") && (q.includes("room") || q.includes("cube") || q.includes("hall"))) {
        const name = roomMatch?.[1]?.trim() ?? "";
        const template = templates.find(
          (t) =>
            t.label.toLowerCase().includes(name) ||
            name.includes(t.label.toLowerCase()) ||
            t.key === name.replace(/\s+/g, "-"),
        );
        if (!template) {
          return {
            text: `I could not find a room called "${name}". Your rooms are: ${exhibitions.flatMap((e) => e.rooms.map((r) => r.name)).join(", ") || "none yet"}. Ask about one of those, or a template like "White Cube".`,
            source: sourceLine,
          };
        }
        const fitting = artworks.filter((a) => {
          const parsed = parseDimensions(a.dimensions);
          if (!parsed) return false;
          const widest = Math.max(parsed.width, parsed.height) / 100;
          return widest + 2 <= template.width;
        });
        const unknown = artworks.filter((a) => !parseDimensions(a.dimensions));
        return {
          text: `${template.label} is ${template.width} × ${template.depth} m with ${template.height} m ceilings.\n\n${fitting.length} of your works fit with breathing room (widest work + 2 m):\n${fitting.map((a) => `• ${a.title} — ${a.dimensions}`).join("\n") || "• none"}${
            unknown.length > 0
              ? `\n\n${unknown.length} work${unknown.length === 1 ? " has" : "s have"} no dimensions recorded, so I cannot check ${unknown.length === 1 ? "it" : "them"}: ${unknown.map((a) => a.title).join(", ")}.`
              : ""
          }`,
          source: `Room size from the ${template.label} template; dimensions from your ${artworks.length} artworks.`,
        };
      }

      // Large works
      if (q.includes("large")) {
        const large = artworks.filter((a) => sizeClass(a.dimensions) === "large" || sizeClass(a.dimensions) === "very large");
        if (large.length === 0) {
          return {
            text: "None of your works with recorded dimensions counts as large (over ~80 × 100 cm). Add dimensions to works that are missing them and I can sort them by size.",
            source: sourceLine,
          };
        }
        return {
          text: `${large.length} large work${large.length === 1 ? "" : "s"}:\n${large.map((a) => `• ${a.title} — ${a.dimensions ?? "no dimensions"} (${sizeClass(a.dimensions)})`).join("\n")}`,
          source: sourceLine,
        };
      }

      // Rooms list
      if (q.includes("room")) {
        const allRooms = exhibitions.flatMap((e) => e.rooms.map((r) => ({ ...r, exhibitionTitle: e.title })));
        if (allRooms.length === 0) {
          return { text: "You have no rooms yet — rooms live inside your exhibitions. Create an exhibition in the editor to add one.", source: sourceLine };
        }
        return {
          text: `You have ${allRooms.length} room${allRooms.length === 1 ? "" : "s"}:\n${allRooms.map((r) => `• ${r.name} (${r.layout}) — ${r.exhibitionTitle}`).join("\n")}`,
          source: sourceLine,
        };
      }

      // Counts
      if (q.includes("how many")) {
        if (q.includes("exhibition")) {
          return {
            text: `You have ${exhibitions.length} exhibition${exhibitions.length === 1 ? "" : "s"}: ${exhibitions.map((e) => `${e.title} (${e.status}, ${e.artworkCount} works)`).join("; ")}.`,
            source: sourceLine,
          };
        }
        return {
          text: `You have ${artworks.length} artwork${artworks.length === 1 ? "" : "s"} across ${exhibitions.length} exhibition${exhibitions.length === 1 ? "" : "s"}.`,
          source: sourceLine,
        };
      }

      // Frame suggestion
      if (q.includes("frame")) {
        // "suggest a frame for <title>" or "for my darkest work"
        const titlePart = /for\s+(.+?)\s*$/.exec(q)?.[1]?.replace(/^(my|the)\s+/, "");
        let target: AiArtworkLike | undefined;
        if (titlePart) {
          if (titlePart.includes("darkest")) {
            target = [...artworks].sort((a, b) => {
              const la = a.color ?? "#ffffff";
              const lb = b.color ?? "#ffffff";
              return la.localeCompare(lb);
            })[0];
            // Sort by recorded colour luminance instead of hex string.
            const luminance = (hex: string) => {
              const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
              if (!m) return 1;
              const [r, g, b] = m.slice(1).map((p) => parseInt(p, 16) / 255);
              return 0.299 * r + 0.587 * g + 0.114 * b;
            };
            target = [...artworks].sort((a, b) => luminance(a.color ?? "#ffffff") - luminance(b.color ?? "#ffffff"))[0];
          } else {
            target = artworks.find((a) => a.title.toLowerCase().includes(titlePart));
          }
        }
        if (!target) {
          return {
            text: `Which work? I can suggest a frame for a named work — for example "suggest a frame for ${artworks[0]?.title ?? "…"}" — or for "my darkest work".`,
            source: sourceLine,
          };
        }
        const suggestion = suggestFrame(target, [target.color ?? "", target.accent ?? ""].filter(Boolean), frames);
        if (!suggestion) {
          return { text: `I could not find a frame to suggest for “${target.title}”.`, source: sourceLine };
        }
        return {
          text: `For “${target.title}” (${target.medium || "medium not recorded"}${target.dimensions ? `, ${target.dimensions}` : ""}, dominant colour ${colourName(target.color ?? "#b8a184")}):\n\n${suggestion.label} — ${suggestion.reason}\n\nIts current frame is ${target.frame ?? "wood"}. Change it in Frame Studio.`,
          source: `Medium, dimensions and recorded colour of “${target.title}”; frame list from Frame Studio.`,
        };
      }

      // No dimensions
      if (q.includes("dimension")) {
        const missing = artworks.filter((a) => !parseDimensions(a.dimensions));
        if (missing.length === 0) {
          return { text: `Every work has dimensions recorded.`, source: sourceLine };
        }
        return {
          text: `${missing.length} work${missing.length === 1 ? " has" : "s have"} no dimensions recorded:\n${missing.map((a) => `• ${a.title}`).join("\n")}`,
          source: sourceLine,
        };
      }

      // Works in an exhibition
      const inMatch = /in\s+(.+?)\s*$/.exec(q);
      if (q.includes("in ") && inMatch) {
        const name = inMatch[1].replace(/^(the|my)\s+/, "");
        const exhibition = exhibitions.find((e) => e.title.toLowerCase().includes(name));
        if (exhibition) {
          const works = artworks.filter((a) => a.exhibitionId === exhibition.id);
          return {
            text: `“${exhibition.title}” has ${works.length} work${works.length === 1 ? "" : "s"}:\n${works.map((a) => `• ${a.title}${a.medium ? ` — ${a.medium}` : ""}`).join("\n") || "• none yet"}`,
            source: sourceLine,
          };
        }
      }

      // Works without image
      if (q.includes("without an image") || q.includes("no image")) {
        const missing = artworks.filter((a) => !a.imageUrl);
        return {
          text:
            missing.length === 0
              ? `Every work has an image.`
              : `${missing.length} work${missing.length === 1 ? " has" : "s have"} no image:\n${missing.map((a) => `• ${a.title}`).join("\n")}`,
          source: sourceLine,
        };
      }

      return null;
    },
    [artworks, exhibitions, frames, templates, savedKinds, sourceLine],
  );

  const sendQuestion = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question) return;
      setInput("");
      setModelError(null);
      const userMessage: Message = { id: uid(), role: "user", text: question };
      const answer = answerQuestion(question);
      const assistantMessage: Message = answer
        ? { id: uid(), role: "assistant", text: answer.text, source: answer.source }
        : {
            id: uid(),
            role: "assistant",
            text: `I cannot answer that from your data and rules. I can only work with what is recorded here — your artworks, exhibitions, rooms, frames and saved work — and the rules built on them.\n\nThings I can answer: which works are unframed, what is missing before publishing, what fits a room, which works are large or lack dimensions, what rooms you have, and frame suggestions for a named work.\n\nIf a model is connected, you can also ask it below — its reply will be labelled as a model answer.`,
            source: sourceLine,
          };
      setMessages((current) => [...current, userMessage, assistantMessage]);
    },
    [answerQuestion, sourceLine],
  );

  const askModel = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || !providerStatus.configured) return;
    setModelBusy(true);
    setModelError(null);
    try {
      const context = [
        `The user has ${artworks.length} artworks and ${exhibitions.length} exhibitions.`,
        `Artworks: ${artworks.map((a) => `${a.title} (${a.medium || "medium unknown"}${a.dimensions ? `, ${a.dimensions}` : ""}, frame ${a.frame || "wood"})`).join("; ") || "none"}.`,
        `Exhibitions: ${exhibitions.map((e) => `${e.title} (${e.status}, ${e.artworkCount} works)`).join("; ") || "none"}.`,
        `Rooms: ${exhibitions.flatMap((e) => e.rooms.map((r) => r.name)).join(", ") || "none"}.`,
      ].join("\n");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${context}\n\nUser question: ${lastUser.text}\n\nAnswer only from the facts above. If the facts do not cover the question, say so plainly instead of inventing an answer.`,
          system: "You are a gallery assistant. Answer only from the supplied project facts. Never invent facts.",
          maxTokens: 600,
        }),
      });
      const json = (await res.json()) as { text?: string; model?: string; provider?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Model request failed.");
      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          text: json.text ?? "",
          source: `Model answer — ${json.provider ?? ""} (${json.model ?? ""}). Check it against your data; it was given only the facts listed above.`,
          model: json.model,
        },
      ]);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Model request failed.");
    } finally {
      setModelBusy(false);
    }
  }, [messages, providerStatus.configured, artworks, exhibitions]);

  const saveSession = useCallback(async () => {
    if (messages.length <= 1) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ai-analysis",
          title: `Assistant session — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          data: {
            session: true,
            messages: messages.map((m) => ({ role: m.role, text: m.text, source: m.source ?? null })),
          },
        }),
      });
      if (!res.ok) throw new Error("save");
      setSaveStatus("Session saved — find it under your saved analyses in Artwork Intelligence.");
    } catch {
      setSaveStatus("Could not save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [messages]);

  const lastAssistantUnanswered =
    messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].text.startsWith("I cannot answer");

  return (
    <div>
      <ProviderPanel status={providerStatus} />

      <section style={S.section}>
        <h2 style={S.sectionTitle}>Ask about your project</h2>
        <p style={S.sectionNote}>
          I answer from your real data — exhibitions, artworks, rooms, frames and saved work — and
          I show my source under every answer. I never invent an answer I cannot ground.
        </p>

        <div style={S.chat}>
          <div style={S.messages}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{ ...S.bubble, ...(m.role === "user" ? S.userBubble : S.assistantBubble) }}
              >
                {m.text}
                {m.source && <span style={S.source}>{m.source}</span>}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={S.chips}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} type="button" style={S.chip} onClick={() => sendQuestion(q)}>
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            style={S.inputRow}
          >
            <input
              style={S.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your works, rooms, frames, publishing…"
              aria-label="Ask the assistant"
            />
            <button type="submit" className="galleries-open-button">
              Ask
            </button>
          </form>

          {lastAssistantUnanswered && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                style={S.ghostButton}
                onClick={() => void askModel()}
                disabled={!providerStatus.configured || modelBusy}
              >
                {modelBusy ? "Asking the model…" : "Ask a model instead"}
              </button>
              <ModelIntegrationNote
                status={providerStatus}
                feature="Open-ended questions that need a language model"
              />
              {modelError && (
                <div style={{ ...S.errorBox, marginTop: 12 }} role="alert">
                  <strong>Model request failed.</strong>
                  <br />
                  {modelError}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={S.controls}>
          <button type="button" style={S.ghostButton} onClick={() => void saveSession()} disabled={saving || messages.length <= 1}>
            {saving ? "Saving…" : "Save this session"}
          </button>
          <button
            type="button"
            style={S.ghostButton}
            onClick={() =>
              setMessages([
                {
                  id: uid(),
                  role: "assistant",
                  text: `Hello — I can answer questions about your actual work here: your ${artworks.length} artworks, ${exhibitions.length} exhibitions and your rooms and frames.`,
                  source: sourceLine,
                },
              ])
            }
          >
            Clear conversation
          </button>
        </div>
        {saveStatus && <p style={S.status}>{saveStatus}</p>}
      </section>

      <section style={S.section}>
        <h2 style={S.sectionTitle}>What I know about your project</h2>
        <p style={S.sectionNote}>
          The data I can actually see — nothing more. If something is missing here, it is missing
          from the record, and I will tell you that too.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "var(--surface-3, #fff)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontSize: 28, fontWeight: 600 }}>{artworks.length}</p>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Artworks</p>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "var(--surface-3, #fff)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontSize: 28, fontWeight: 600 }}>{exhibitions.length}</p>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Exhibitions</p>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "var(--surface-3, #fff)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontSize: 28, fontWeight: 600 }}>
              {exhibitions.reduce((n, e) => n + e.rooms.length, 0)}
            </p>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Rooms</p>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "var(--surface-3, #fff)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontSize: 28, fontWeight: 600 }}>{frames.length}</p>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Frame styles</p>
          </div>
        </div>
      </section>
    </div>
  );
}

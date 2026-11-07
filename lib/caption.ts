// Automatic artwork descriptions via Transformers.js — everything runs
// in the browser: no key, no server, no image ever leaves the machine.
// The captioning model (Xenova/vit-gpt2-image-captioning, ViT + GPT-2,
// the standard Hugging Face image-captioning model, Apache-2.0) downloads
// once from the Hugging Face Hub and is cached by the browser; a failure
// (offline, incompatible browser, model host unreachable) returns null
// and never blocks an upload or a save — the editor retries it from the
// manual "Generate description" button.
//
// Model note (7 Nov 2026): BLIP was the first choice, but its ONNX
// build (Xenova/blip-image-captioning-base) no longer resolves on the
// Hub (the Xenova org lists no BLIP model any more; the API answers
// 401) and the onnx-community replacement is packaged for another
// runtime (split .onnx files, no config.json, no tokenizer), so it
// cannot be loaded by Transformers.js v2. ViT-GPT2 is the equivalent
// public Transformers.js image-captioning model — same "image-to-text"
// pipeline, same one-sentence caption output, lighter to download
// (~250 MB quantized, BLIP was ~400 MB). If a BLIP ONNX build in the
// Transformers.js layout returns to the Hub, swap CAPTION_MODEL back.
//
// Gemini 2.5 Flash (free, 250 requests/day) is an optional richer
// fallback, served by /api/describe only when GEMINI_API_KEY is set.
// The client helpers below (enrichWithGemini / isGeminiAvailable) just
// talk to that route; they never see a key.

export type CaptionSource = "caption" | "gemini";

export type ArtworkCaption = {
  altText: string;
  description: string;
  source: CaptionSource;
};

export type CaptionStatus = "loading-model" | "describing";

export const CAPTION_MODEL = "Xenova/vit-gpt2-image-captioning";

// The placeholder a new artwork gets until the artist writes their own
// description — a generated draft replaces it, never an artist's own text.
export const DEFAULT_ARTWORK_DESCRIPTION =
  "Add a description to tell visitors about this work.";

export const CAPTION_MAX_ALT = 500;
export const CAPTION_MAX_DESCRIPTION = 2000;

// --- draft building --------------------------------------------------------

// Turn a raw caption ("a black and white portrait of a woman holding a
// yellow flower") into the two fields the editor pre-fills: the alt-text
// is the caption itself, the description is a one-sentence draft built
// from it. Both are proposals — the artist edits or discards them before
// saving. Returns null for a caption too short to be useful.
export function buildCaptionDraft(
  rawCaption: string,
  source: CaptionSource,
): ArtworkCaption | null {
  const cleaned = rawCaption.trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  if (cleaned.length < 3) return null;
  const lowerFirst = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  const altText = (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, CAPTION_MAX_ALT);
  const description = `This work shows ${lowerFirst}.`.slice(0, CAPTION_MAX_DESCRIPTION);
  return { altText, description, source };
}

// --- Captioning model (in the browser) --------------------------------------

type ImageToTextFn = (image: string) => Promise<Array<{ generated_text: string }>>;

// One pipeline for the whole session: the model downloads once and is
// cached by the browser. A failed load is NOT cached — the next call
// (e.g. the manual retry, once back online) tries again.
let captionerPromise: Promise<ImageToTextFn | null> | null = null;

async function getCaptioner(
  onStatus?: (status: CaptionStatus) => void,
): Promise<ImageToTextFn | null> {
  if (captionerPromise) return captionerPromise;
  const promise = (async (): Promise<ImageToTextFn | null> => {
    try {
      onStatus?.("loading-model");
      const { pipeline } = await import("@xenova/transformers");
      const captioner = await pipeline("image-to-text", CAPTION_MODEL);
      return captioner as unknown as ImageToTextFn;
    } catch {
      return null;
    }
  })();
  captionerPromise = promise;
  const result = await promise;
  if (!result) captionerPromise = null;
  return result;
}

/** Describe an artwork image with the captioning model, in the browser.
 * Accepts the uploaded File (decoded locally via an object URL) or a
 * same-origin image URL. Returns null on any failure — the caller keeps
 * the upload and the save going without a description. */
export async function generateCaption(
  source: File | string,
  onStatus?: (status: CaptionStatus) => void,
): Promise<ArtworkCaption | null> {
  try {
    const captioner = await getCaptioner(onStatus);
    if (!captioner) return null;
    onStatus?.("describing");
    let objectUrl: string | null = null;
    try {
      const image =
        source instanceof File ? (objectUrl = URL.createObjectURL(source)) : source;
      const output = await captioner(image);
      const raw = Array.isArray(output) ? output[0]?.generated_text : null;
      return typeof raw === "string" ? buildCaptionDraft(raw, "caption") : null;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

// --- Gemini (optional server fallback) -------------------------------------

/** Ask the server for a richer description (Gemini 2.5 Flash). Returns
 * null when Gemini is not set up on this site, when it does not answer,
 * or when its answer is unusable — the caption suggestion (if any) is kept. */
export async function enrichWithGemini(imageUrl: string): Promise<ArtworkCaption | null> {
  try {
    const response = await fetch("/api/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { altText?: unknown; description?: unknown };
    if (typeof result.altText !== "string" || typeof result.description !== "string") return null;
    const altText = result.altText.trim().slice(0, CAPTION_MAX_ALT);
    const description = result.description.trim().slice(0, CAPTION_MAX_DESCRIPTION);
    if (!altText || !description) return null;
    return { altText, description, source: "gemini" };
  } catch {
    return null;
  }
}

/** Whether the server can enrich with Gemini (i.e. GEMINI_API_KEY is
 * set). The editor calls this once to decide whether to show the
 * "Enrich with Gemini" button at all. */
export async function isGeminiAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/describe", { method: "GET" });
    if (!response.ok) return false;
    const result = (await response.json()) as { available?: unknown };
    return result.available === true;
  } catch {
    return false;
  }
}

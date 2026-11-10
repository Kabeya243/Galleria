// Open Calls (Nov 2026): shared field types, slug building and answer
// validation for the owner API, the public form and the responses list.

export const OPEN_CALL_FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "number",
  "date",
  "select",
  "checkbox",
  "file",
] as const;

export type OpenCallFieldType = (typeof OPEN_CALL_FIELD_TYPES)[number];

export const OPEN_CALL_FIELD_LABELS: Record<OpenCallFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Checkboxes",
  file: "File upload",
};

// The option-list field types (select, checkbox) need at least one
// choice; the others ignore options.
export function fieldTypeHasOptions(type: string): boolean {
  return type === "select" || type === "checkbox";
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "open-call";
}

// A public link slug: readable from the title plus a short random tail,
// so two calls with the same title never collide.
export function buildCallSlug(title: string): string {
  const tail = Math.random().toString(36).slice(2, 8);
  return `${slugifyTitle(title)}-${tail}`;
}

export type OpenCallFieldInput = {
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

export function cleanFieldInput(input: unknown): OpenCallFieldInput | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const type = typeof row.type === "string" ? row.type : "";
  if (!label || !(OPEN_CALL_FIELD_TYPES as readonly string[]).includes(type)) return null;
  const options = Array.isArray(row.options)
    ? row.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean)
    : [];
  if (fieldTypeHasOptions(type) && options.length === 0) return null;
  return {
    label: label.slice(0, 120),
    type,
    required: row.required === true,
    options: fieldTypeHasOptions(type) ? options.slice(0, 50) : [],
  };
}

// Validate one submitted response against the call's fields. Returns
// the cleaned answers map, or an error message for the first problem.
// File answers must arrive as { key, name } where key is a file the
// public upload route stored (open-calls/<slug>/<uuid>.<ext>).
export type CleanedAnswers = Record<
  string,
  string | number | string[] | { key: string; name: string }
>;

export function validateAnswers(
  fields: Array<{ id: string; label: string; type: string; required: boolean; options: unknown }>,
  answers: unknown,
): { answers: CleanedAnswers } | { error: string } {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { error: "Answers are required." };
  }
  const raw = answers as Record<string, unknown>;
  const cleaned: CleanedAnswers = {};
  for (const field of fields) {
    const value = raw[field.id];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (missing) {
      if (field.required) return { error: `"${field.label}" is required.` };
      continue;
    }
    if (field.type === "email") {
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return { error: `"${field.label}" must be a valid email address.` };
      }
      cleaned[field.id] = value.trim();
    } else if (field.type === "number") {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return { error: `"${field.label}" must be a number.` };
      cleaned[field.id] = num;
    } else if (field.type === "select") {
      const options = Array.isArray(field.options) ? (field.options as unknown[]) : [];
      if (typeof value !== "string" || !options.includes(value)) {
        return { error: `"${field.label}" must be one of the listed choices.` };
      }
      cleaned[field.id] = value;
    } else if (field.type === "checkbox") {
      const options = Array.isArray(field.options) ? (field.options as unknown[]) : [];
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !options.includes(v))) {
        return { error: `"${field.label}" must only use the listed choices.` };
      }
      cleaned[field.id] = value;
    } else if (field.type === "file") {
      const fileValue = value as Record<string, unknown> | null;
      const fileKey = typeof fileValue?.key === "string" ? fileValue.key : "";
      const fileName = typeof fileValue?.name === "string" ? fileValue.name : "";
      if (
        typeof value !== "object" ||
        value === null ||
        !fileKey ||
        !fileName ||
        !/^open-calls\/[A-Za-z0-9-]+\/[a-f0-9-]{36}\.(png|jpe?g|webp|avif|pdf)$/i.test(fileKey)
      ) {
        return { error: `"${field.label}" needs a file uploaded through the form.` };
      }
      cleaned[field.id] = { key: fileKey, name: fileName.slice(0, 200) };
    } else {
      // short_text, long_text, date: plain strings.
      if (typeof value !== "string") return { error: `"${field.label}" must be text.` };
      cleaned[field.id] = value.slice(0, 5000);
    }
  }
  return { answers: cleaned };
}

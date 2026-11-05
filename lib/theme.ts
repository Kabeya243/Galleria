export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "sanaa-theme";

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return choice;
}

export function getStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // storage unavailable (private mode, etc.) — fall through to system
  }
  return "system";
}

export function applyTheme(choice: ThemeChoice) {
  const effective = resolveTheme(choice);
  document.documentElement.dataset.theme = effective;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage unavailable — the theme still applies for this visit
  }
  window.dispatchEvent(new CustomEvent("sanaa-theme-change", { detail: choice }));
}

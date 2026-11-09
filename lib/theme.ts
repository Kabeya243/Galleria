export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "sanaa-theme";

// The choice currently applied (in memory).
let currentChoice: ThemeChoice = "system";

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
    // storage unavailable (private mode, etc.), fall through to system
  }
  return "system";
}

export function applyTheme(choice: ThemeChoice) {
  currentChoice = choice;
  const effective = resolveTheme(choice);
  document.documentElement.dataset.theme = effective;
  // The choice is remembered (local storage + cookie mirror) so the
  // visitor finds their theme again on the next visit. Language and
  // theme cookies are essential to the platform, so they are always
  // active; the cookie notice only informs the visitor.
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage unavailable, the theme still applies for this visit
  }
  // Mirror the choice into a cookie too, so it survives local storage
  // being cleared and the server can read it on the next visit. Same
  // value, same meaning; anonymous, no personal data.
  try {
    document.cookie = `${STORAGE_KEY}=${choice}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  } catch {
    // cookies unavailable, local storage still holds the choice
  }
  window.dispatchEvent(new CustomEvent("sanaa-theme-change", { detail: choice }));
}

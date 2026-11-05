"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, resolveTheme, type ThemeChoice } from "@/lib/theme";

export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [effective, setEffective] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () => {
      const stored = getStoredTheme();
      setChoice(stored);
      setEffective(resolveTheme(stored));
    };
    sync();
    window.addEventListener("sanaa-theme-change", sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("sanaa-theme-change", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  function toggle() {
    applyTheme(effective === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-button theme-toggle"
      aria-label={effective === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={effective === "dark" ? "Light mode" : "Dark mode"}
    >
      {effective === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

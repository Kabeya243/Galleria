"use client";

import { useState } from "react";

// Homepage highlight toggle, one per row in /admin/exhibitions
// (Nov 2026): a star that puts the exhibition on the homepage hero.
// Only shown to admins who hold the exhibitions.highlight permission
// (the manager always does). The page reloads after a change so the
// table shows the new state.
export default function AdminExhibitionHighlight({
  exhibitionId,
  highlighted,
  canHighlight,
}: {
  exhibitionId: string;
  highlighted: boolean;
  canHighlight: boolean;
}) {
  const [isHighlighted, setIsHighlighted] = useState(highlighted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canHighlight) {
    return <span title={isHighlighted ? "Highlighted on the homepage" : "Not highlighted"}>{isHighlighted ? "★" : "—"}</span>;
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/exhibitions/${encodeURIComponent(exhibitionId)}/highlight`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlighted: !isHighlighted }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as { error?: string; highlighted?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Could not change the highlight.");
      setIsHighlighted(result.highlighted ?? !isHighlighted);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the highlight.");
      setBusy(false);
    }
  }

  return (
    <span className="ad-highlight-toggle">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-pressed={isHighlighted}
        title={isHighlighted ? "Remove from the homepage hero" : "Put on the homepage hero"}
      >
        {isHighlighted ? "★ Highlighted" : "☆ Highlight"}
      </button>
      {error && (
        <span className="ad-highlight-toggle-error" role="alert">
          {error}
        </span>
      )}
      <style>{`
        .ad-highlight-toggle { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .ad-highlight-toggle button { padding: 5px 9px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .ad-highlight-toggle button[aria-pressed="true"] { border-color: var(--accent, #a38348); color: var(--accent, #a38348); }
        .ad-highlight-toggle button:disabled { opacity: .5; cursor: not-allowed; }
        .ad-highlight-toggle-error { color: #7a2e22; font-size: 12px; }
      `}</style>
    </span>
  );
}

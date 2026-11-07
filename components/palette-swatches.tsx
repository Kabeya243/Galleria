"use client";

import { useEffect, useRef, useState } from "react";

// Colour palette swatches for one artwork: the dominant colour first,
// then the rest. Click a swatch to copy its hex code (inline feedback,
// no alert). Used on the artwork sheet in the editor and on the public
// artwork detail panel.
export default function PaletteSwatches({
  palette,
  size = 26,
  label = "Colour palette",
}: {
  palette: string[];
  size?: number;
  label?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // Clipboard unavailable (old browser, no permission): select the
      // text the old way so the user can still copy it by hand.
      const area = document.createElement("textarea");
      area.value = hex;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(hex);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <div className="wall-swatches" role="group" aria-label={label}>
        {palette.map((hex, index) => (
          <button
            key={`${hex}-${index}`}
            type="button"
            className="wall-swatch"
            style={{ backgroundColor: hex, width: size, height: size }}
            title={`${index === 0 ? "Dominant — " : ""}${hex} (click to copy)`}
            aria-label={`${index === 0 ? "Dominant colour" : "Palette colour"} ${hex}, click to copy`}
            onClick={() => void copyHex(hex)}
          />
        ))}
      </div>
      <p
        style={{
          margin: "6px 0 0",
          color: "var(--muted)",
          fontSize: "8px",
          lineHeight: 1.6,
          minHeight: "13px",
        }}
        role="status"
      >
        {copied ? `Copied ${copied}` : "Click a swatch to copy its hex code."}
      </p>
    </div>
  );
}

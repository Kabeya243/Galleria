"use client";

import { useState } from "react";
import FrameStudio, { type FrameStudioArtwork } from "@/components/frame-studio";
import MockupStudio from "@/components/mockup-studio";

// Frames & Art on Walls: the merged tool. One tool, two views sharing the
// same artworks:
//   (1) Frames — pick an artwork, pick a realistic frame (the real
//       moulding photo, not a flat motif), customise width, matboard and
//       glass, compare up to 4 frames, and save the frame to the artwork.
//   (2) Art on Walls — pick an artwork and one of the 10 real wall
//       photos, place the framed artwork on the wall, and export.
// Both views stay mounted and are only hidden, so a chosen frame, a wall
// and a placement all survive switching views. The old routes
// /tools/frame-studio and /tools/mockup-studio redirect here.
export default function FramesWallsTool({
  artworks,
  initialArtworkId,
  initialView,
}: {
  artworks: FrameStudioArtwork[];
  initialArtworkId?: string;
  initialView?: "frames" | "walls";
}) {
  const [view, setView] = useState<"frames" | "walls">(initialView ?? "frames");

  return (
    <div>
      <style>{`
        .fw-tabs { display: flex; gap: 8px; margin: 0 0 16px; flex-wrap: wrap; }
        .fw-tab { border: 1px solid var(--border); background: var(--surface-3); color: var(--ink); border-radius: 999px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .fw-tab[aria-selected="true"] { background: var(--ink); color: var(--surface-3); border-color: var(--ink); }
        .fw-intro { margin: 0 0 16px; color: var(--muted); font-size: 12px; line-height: 1.7; max-width: 720px; }
      `}</style>
      <p className="fw-intro">
        Frame your artworks in realistic frames, save the frame to the work, then hang it on a real wall photo and
        export a print-ready mockup.
      </p>
      <div className="fw-tabs" role="tablist" aria-label="Frames and Art on Walls views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "frames"}
          className="fw-tab"
          onClick={() => setView("frames")}
        >
          Frames
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "walls"}
          className="fw-tab"
          onClick={() => setView("walls")}
        >
          Art on Walls
        </button>
      </div>

      <div role="tabpanel" aria-label="Frames" style={{ display: view === "frames" ? "" : "none" }}>
        <FrameStudio artworks={artworks} initialArtworkId={initialArtworkId} />
      </div>
      <div role="tabpanel" aria-label="Art on Walls" style={{ display: view === "walls" ? "" : "none" }}>
        <MockupStudio
          initialArtworkId={initialArtworkId}
          artworks={artworks.map((a) => ({
            id: a.id,
            title: a.title,
            medium: a.medium,
            dimensions: a.dimensions,
            year: a.year,
            color: a.color,
            accent: a.accent,
            imageUrl: a.imageUrl,
            exhibitionTitle: a.exhibitionTitle,
            frame: a.frame,
          }))}
        />
      </div>
    </div>
  );
}

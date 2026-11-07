// The capture view: one gallery, full viewport, from its entrance.
// walkMode places the camera at the room's camera start on mount
// (even with walking off); `bare` hides the quality toggle and the
// sun slider, so the screenshot is just the room. Medium render
// quality: shadows and environment stay, the expensive 2048 px
// directional shadow maps go — the captures render in reasonable
// time under software WebGL. After the scene has rendered 3 frames
// and at least 2 s have passed (photo textures load asynchronously),
// the wrapper marks itself data-capture-ready for the screenshot
// script to poll.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GalleryScene from "@/components/gallery-scene";
import { createGalleryRoom, type RoomLayout } from "@/lib/rooms";

export default function CaptureView({ layout }: { layout: RoomLayout }) {
  const room = useMemo(() => createGalleryRoom(0, layout), [layout]);
  const input = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const started = Date.now();
    let frames = 0;
    let raf = 0;
    const tick = () => {
      frames += 1;
      if (frames >= 3 && Date.now() - started >= 2000) {
        setReady(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      data-capture-ready={ready ? "true" : undefined}
      style={{ position: "fixed", inset: 0, background: "#dfe6ee" }}
    >
      <GalleryScene
        artworks={[]}
        room={room}
        rooms={[room]}
        activeRoomId={room.id}
        className="gallery-canvas"
        interior
        walkMode
        walking={false}
        input={input}
        quality="medium"
        bare
      />
    </div>
  );
}

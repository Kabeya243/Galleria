"use client";

import { useCallback, useState } from "react";

// Shared avatar: the creator's profile photo when set, otherwise the
// initials fallback that was already used everywhere. The caller supplies
// the sizing/shape class (settings-avatar, profile-avatar, dashboard
// avatar, …) — the photo fills it with object-fit cover and inherits its
// border radius, so every surface keeps its own look.
// When the photo URL is dead (a stale R2 link, a deleted upload), the
// image swaps to the initials instead of showing a broken icon or the
// alt text spilling out of the circle. The ref callback catches the case
// where the image already failed before hydration attached onError.

export default function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  }, []);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (avatarUrl && !failed) {
    return (
      <span className={className} style={{ overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={avatarUrl}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }}
        />
      </span>
    );
  }
  return <span className={className}>{initials}</span>;
}

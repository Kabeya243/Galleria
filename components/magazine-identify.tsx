"use client";

// Ensures the anonymous visitor cookie exists (POST /api/visits with
// identifyOnly), so the magazine views counter can dedup repeat reads
// by the same visitor. Same pattern as the public exhibition pages.
// No sign-in, no personal data.
import { useEffect } from "react";

export default function MagazineIdentify() {
  useEffect(() => {
    fetch("/api/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifyOnly: true }),
      credentials: "same-origin",
    }).catch(() => {
      // Offline or blocked: the article still renders, the view is
      // just counted without a stable visitor key this once.
    });
  }, []);
  return null;
}

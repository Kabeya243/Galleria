"use client";

import { useEffect } from "react";

// Registers the Lakisa service worker (public/sw.js). Production only:
// in development the worker would cache dev assets and confuse rebuilds.
// The worker only caches static assets (/_next/static, /brand, /icons,
// /fonts) — pages and /api/* are never cached, so no authenticated page
// can leak between users.
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is a progressive enhancement: if it fails, Lakisa
      // still works exactly as before, just without offline caching.
    });
  }, []);

  return null;
}

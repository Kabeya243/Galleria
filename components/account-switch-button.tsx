"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

// One-click switch from the Kabeya admin account to the Lakisa Official
// account (Nov 2026). Renders nothing unless the signed-in email is
// exactly kabeyailunga243@gmail.com — for every other account (including
// official@lakisa.art itself) and for visitors there is no button at
// all. The server endpoint enforces the same rule, so hiding the button
// is only the first layer, never the security itself.
//
// One direction only: admin -> Lakisa Official. There is deliberately
// no return button on the Official account.
const ADMIN_EMAIL = "kabeyailunga243@gmail.com";

export default function AccountSwitchButton({ email }: { email: string }) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the admin account ever sees this button.
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return null;

  async function switchAccount() {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/switch-account", {
        method: "POST",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Could not switch accounts.");
      // Land on the dashboard as Lakisa Official.
      window.location.assign("/dashboard");
    } catch (err) {
      console.error("Account switch failed.", err);
      setError(err instanceof Error ? err.message : "Could not switch accounts.");
      setSwitching(false);
    }
  }

  const label = switching ? "Basculement…" : "Basculer vers Lakisa Official";

  // Matches the admin shell's Sign out item (ad-nav-item): same row,
  // same collapsed-rail behaviour (label hides, icon stays).
  return (
    <>
      <button type="button" className="ad-nav-item" onClick={switchAccount} disabled={switching} title="Basculer vers Lakisa Official">
        <span className="ad-nav-icon">
          <ArrowLeftRight size={18} />
        </span>
        <span className="ad-nav-label">{label}</span>
      </button>
      {error && <span className="ad-nav-item" style={{ color: "#e5484d", fontSize: 12 }}>{error}</span>}
    </>
  );
}

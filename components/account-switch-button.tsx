"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

// One-click account switch between Kabeya's two Lakisa accounts, without
// typing a password (Nov 2026). Renders nothing unless the signed-in
// email is exactly one of the two accounts — for every other account
// and for visitors there is no button at all. The server endpoint
// enforces the same rule, so hiding the button is only the first layer,
// never the security itself.
//
// Direction follows the signed-in account:
//   kabeyailunga243@gmail.com (admin) -> official@lakisa.art, label
//     "Basculer vers Lakisa Official", rendered in the admin shell
//     (variant "admin").
//   official@lakisa.art (Lakisa Official) -> kabeyailunga243@gmail.com,
//     label "Basculer vers l'admin", rendered in the sidebar
//     (variant "sidebar").
// The variant only picks the styling so the button matches where it
// lives (the admin rail and the sidebar rail each hide their own label
// class when collapsed).
const ADMIN_EMAIL = "kabeyailunga243@gmail.com";
const OFFICIAL_EMAIL = "official@lakisa.art";

const VARIANTS = {
  admin: { button: "ad-nav-item", icon: "ad-nav-icon", label: "ad-nav-label" },
  sidebar: { button: "nav-item", icon: "", label: "nav-item-label" },
} as const;

export default function AccountSwitchButton({
  email,
  variant,
}: {
  email: string;
  variant: "admin" | "sidebar";
}) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const direction =
    email.trim().toLowerCase() === ADMIN_EMAIL
      ? { label: "Basculer vers Lakisa Official" }
      : email.trim().toLowerCase() === OFFICIAL_EMAIL
        ? { label: "Basculer vers l'admin" }
        : null;

  // Only the two accounts ever see a button.
  if (!direction) return null;
  const classes = VARIANTS[variant];

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
      // Land on the dashboard as the other account. The dashboard is
      // "/" (there is no /dashboard page — app/dashboard only holds
      // plan, analytics and orders).
      window.location.assign("/");
    } catch (err) {
      console.error("Account switch failed.", err);
      setError(err instanceof Error ? err.message : "Could not switch accounts.");
      setSwitching(false);
    }
  }

  const label = switching ? "Basculement…" : direction.label;

  return (
    <>
      <button type="button" className={classes.button} onClick={switchAccount} disabled={switching} title={direction.label}>
        {classes.icon ? (
          <span className={classes.icon}>
            <ArrowLeftRight size={18} />
          </span>
        ) : (
          <ArrowLeftRight size={17} />
        )}
        <span className={classes.label}>{label}</span>
      </button>
      {error && <span className={classes.button} style={{ color: "#e5484d", fontSize: 12 }}>{error}</span>}
    </>
  );
}

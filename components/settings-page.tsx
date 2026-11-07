"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import LanguageSwitcher from "@/components/language-switcher";
import { useT } from "@/lib/i18n";
import { applyTheme, getStoredTheme, type ThemeChoice } from "@/lib/theme";

export default function SettingsPage({
  user,
}: {
  user: { name: string; email: string; createdAt: string | null; exhibitionCount: number; isAdmin?: boolean };
}) {
  const router = useRouter();
  const t = useT();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [name, setName] = useState(user.name);
  const [profileNote, setProfileNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNote, setDeleteNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const sync = () => setTheme(getStoredTheme());
    sync();
    window.addEventListener("sanaa-theme-change", sync);
    return () => window.removeEventListener("sanaa-theme-change", sync);
  }, []);

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileNote(null);
    setSavingProfile(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update your profile right now.");
      setProfileNote({ ok: true, text: "Saved." });
      router.refresh();
    } catch (error) {
      setProfileNote({
        ok: false,
        text: error instanceof Error ? error.message : "Could not update your profile right now.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordNote({ ok: false, text: "The new passwords don't match." });
      return;
    }
    setPasswordNote(null);
    setSavingPassword(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not change your password right now.");
      setPasswordNote({ ok: true, text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordNote({
        ok: false,
        text: error instanceof Error ? error.message : "Could not change your password right now.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  async function deleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteNote(null);
    try {
      const response = await fetch("/api/settings/account", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not delete your account right now.");
      window.location.assign("/register");
    } catch (error) {
      setDeleteNote(
        error instanceof Error ? error.message : "Could not delete your account right now.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="settings" exhibitionCount={user.exhibitionCount} />

      <section className="settings-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>Settings</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        <div className="settings-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR ACCOUNT</p>
              <h1>
                Settings<span className="title-period">.</span>
              </h1>
              <p className="welcome-copy">Your profile, your password, and how SANAA looks.</p>
            </div>
          </section>

          <section className="settings-section">
            <h2>Appearance</h2>
            <p>Choose how SANAA looks on this device. System follows your device setting.</p>
            <div className="settings-theme-options">
              {(["light", "dark", "system"] as ThemeChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`settings-theme-option${theme === choice ? " active" : ""}`}
                  onClick={() => applyTheme(choice)}
                >
                  {choice === "light" ? (
                    <Sun size={15} />
                  ) : choice === "dark" ? (
                    <Moon size={15} />
                  ) : (
                    <Monitor size={15} />
                  )}
                  {choice === "light" ? "Light" : choice === "dark" ? "Dark" : "System"}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h2>{t("settings", "language")}</h2>
            <p>{t("settings", "languageDesc")}</p>
            <LanguageSwitcher />
          </section>

          <section className="settings-section">
            <h2>Profile</h2>
            <p>This is how your name appears across your workspace.</p>
            <div className="settings-profile-head">
              <div className="settings-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{user.name}</strong>
                <span>
                  Member since {memberSince} · {user.exhibitionCount} exhibition
                  {user.exhibitionCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <form onSubmit={saveProfile}>
              <div className="settings-field">
                <label htmlFor="settings-name">Your name</label>
                <input
                  id="settings-name"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-email">Email</label>
                <input id="settings-email" value={user.email} disabled />
                <small>Your email address can&apos;t be changed. It identifies your account.</small>
              </div>
              <div className="settings-row">
                <button type="submit" className="settings-save" disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
                {profileNote && (
                  <span className={`settings-note ${profileNote.ok ? "ok" : "err"}`}>
                    {profileNote.text}
                  </span>
                )}
              </div>
            </form>
          </section>

          <section className="settings-section">
            <h2>Password</h2>
            <p>Change your password. You&apos;ll stay signed in on this device.</p>
            <form onSubmit={changePassword}>
              <div className="settings-field">
                <label htmlFor="settings-current-password">Current password</label>
                <input
                  id="settings-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={1}
                  maxLength={72}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-new-password">New password</label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 10 characters"
                />
                <small>
                  At least 10 characters, including an uppercase letter, a lowercase letter and
                  a number.
                </small>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-confirm-password">Confirm new password</label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
              <div className="settings-row">
                <button type="submit" className="settings-save" disabled={savingPassword}>
                  {savingPassword ? "Saving…" : "Change password"}
                </button>
                {passwordNote && (
                  <span className={`settings-note ${passwordNote.ok ? "ok" : "err"}`}>
                    {passwordNote.text}
                  </span>
                )}
              </div>
            </form>
          </section>

          <section className="settings-section">
            <h2>Session</h2>
            <p>Sign out of SANAA on this device.</p>
            <button type="button" className="settings-save" onClick={signOut}>
              Sign out
            </button>
          </section>

          <section className="settings-section settings-danger">
            <h2>Delete account</h2>
            <p>
              Permanently delete your account and all your exhibitions and artworks. This
              can&apos;t be undone.
            </p>
            <div className="settings-row">
              <button
                type="button"
                className={`settings-delete${confirmDelete ? " confirm" : ""}`}
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting
                  ? "Deleting…"
                  : confirmDelete
                    ? "Click again to confirm"
                    : "Delete my account"}
              </button>
              {deleteNote && <span className="settings-note err">{deleteNote}</span>}
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>© 2026 SANAA Studio</span>
            <span>Made for art, made for everyone.</span>
            <span className="demo-label">YOUR WORKSPACE</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

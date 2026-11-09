"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import Avatar from "@/components/avatar";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import LanguageSwitcher from "@/components/language-switcher";
import { LOCALE_TAGS, useLocale, useT } from "@/lib/i18n";
import { applyTheme, getStoredTheme, type ThemeChoice } from "@/lib/theme";

// Square-crop an image file to a 512 px JPEG (centre crop) in the browser,
// so the avatar upload is small and always square before it reaches R2.
async function squareCropToJpeg(file: File, size = 512): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare this image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not prepare this image.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export default function SettingsPage({
  user,
}: {
  user: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null; createdAt: string | null; exhibitionCount: number; isAdmin?: boolean };
}) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [avatarNote, setAvatarNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
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
    ? new Date(user.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : LOCALE_TAGS[locale], {
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
        body: JSON.stringify({ name, bio: bio.trim() === "" ? null : bio.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("settings", "couldNotUpdateProfile"));
      setProfileNote({ ok: true, text: t("settings", "saved") });
      router.refresh();
    } catch (error) {
      setProfileNote({
        ok: false,
        text: error instanceof Error ? error.message : t("settings", "couldNotUpdateProfile"),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarNote(null);
    setUploadingAvatar(true);
    try {
      const cropped = await squareCropToJpeg(file);
      const form = new FormData();
      form.append("file", cropped);
      const up = await fetch("/api/uploads/r2", { method: "POST", body: form });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error ?? t("settings", "couldNotUploadAvatar"));
      const url = upJson.url as string;
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl: url }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? t("settings", "couldNotUpdateProfile"));
      setAvatarUrl(url);
      setAvatarNote({ ok: true, text: t("settings", "avatarSaved") });
      router.refresh();
    } catch (error) {
      setAvatarNote({
        ok: false,
        text: error instanceof Error ? error.message : t("settings", "couldNotUploadAvatar"),
      });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarNote(null);
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl: null }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? t("settings", "couldNotUpdateProfile"));
      setAvatarUrl(null);
      setAvatarNote({ ok: true, text: t("settings", "avatarRemoved") });
      router.refresh();
    } catch (error) {
      setAvatarNote({
        ok: false,
        text: error instanceof Error ? error.message : t("settings", "couldNotUpdateProfile"),
      });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordNote({ ok: false, text: t("settings", "passwordsDontMatch") });
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
      if (!response.ok) throw new Error(result.error ?? t("settings", "couldNotChangePassword"));
      setPasswordNote({ ok: true, text: t("settings", "passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordNote({
        ok: false,
        text: error instanceof Error ? error.message : t("settings", "couldNotChangePassword"),
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
      if (!response.ok) throw new Error(result.error ?? t("settings", "couldNotDeleteAccount"));
      window.location.assign("/register");
    } catch (error) {
      setDeleteNote(
        error instanceof Error ? error.message : t("settings", "couldNotDeleteAccount"),
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
            <span>{t("common", "workspace")}</span>
            <span className="crumb-slash">/</span>
            <strong>{t("settings", "title")}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        <div className="settings-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{t("settings", "yourAccount")}</p>
              <h1>
                {t("settings", "title")}<span className="title-period">.</span>
              </h1>
              <p className="welcome-copy">{t("settings", "settingsDesc")}</p>
            </div>
          </section>

          <section className="settings-section">
            <h2>{t("settings", "appearance")}</h2>
            <p>{t("settings", "appearanceDesc")}</p>
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
                  {choice === "light" ? t("settings", "light") : choice === "dark" ? t("settings", "dark") : t("settings", "system")}
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
            <h2>{t("settings", "profile")}</h2>
            <p>{t("settings", "profileDesc")}</p>
            <div className="settings-profile-head">
              <Avatar name={user.name} avatarUrl={avatarUrl} className="settings-avatar" />
              <div>
                <strong>{user.name}</strong>
                <span>
                  {t("settings", "memberSince")} {memberSince} · {user.exhibitionCount}{" "}
                  {user.exhibitionCount === 1 ? t("settings", "exhibition") : t("settings", "exhibitions")}
                </span>
                <span className="settings-row" style={{ marginTop: 8 }}>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    hidden
                    aria-label={t("settings", "uploadAvatar")}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                    }}
                  />
                  <button
                    type="button"
                    className="settings-save"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {uploadingAvatar ? t("settings", "uploading") : t("settings", "uploadAvatar")}
                  </button>
                  {avatarUrl && (
                    <button type="button" className="settings-delete" disabled={uploadingAvatar} onClick={() => void removeAvatar()}>
                      {t("settings", "removeAvatar")}
                    </button>
                  )}
                  {avatarNote && (
                    <span className={`settings-note ${avatarNote.ok ? "ok" : "err"}`}>{avatarNote.text}</span>
                  )}
                </span>
                <small>{t("settings", "avatarHint")}</small>
                <span>
                  <Link href={`/works/${user.id}`} target="_blank" rel="noreferrer">
                    {t("works", "viewPublicPage")} ↗
                  </Link>
                </span>
              </div>
            </div>
            <form onSubmit={saveProfile}>
              <div className="settings-field">
                <label htmlFor="settings-name">{t("settings", "yourName")}</label>
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
                <label htmlFor="settings-bio">{t("settings", "yourBio")}</label>
                <textarea
                  id="settings-bio"
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("settings", "bioPlaceholder")}
                />
                <small>{t("settings", "bioHint")}</small>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-email">{t("settings", "email")}</label>
                <input id="settings-email" value={user.email} disabled />
                <small>{t("settings", "emailNote")}</small>
              </div>
              <div className="settings-row">
                <button type="submit" className="settings-save" disabled={savingProfile}>
                  {savingProfile ? t("settings", "saving") : t("settings", "saveChanges")}
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
            <h2>{t("settings", "password")}</h2>
            <p>{t("settings", "passwordDesc")}</p>
            <form onSubmit={changePassword}>
              <div className="settings-field">
                <label htmlFor="settings-current-password">{t("settings", "currentPassword")}</label>
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
                <label htmlFor="settings-new-password">{t("settings", "newPassword")}</label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t("settings", "passwordPlaceholder")}
                />
                <small>{t("settings", "passwordHint")}</small>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-confirm-password">{t("settings", "confirmNewPassword")}</label>
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
                  {savingPassword ? t("settings", "saving") : t("settings", "changePassword")}
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
            <h2>{t("settings", "session")}</h2>
            <p>{t("settings", "sessionDesc")}</p>
            <button type="button" className="settings-save" onClick={signOut}>
              {t("common", "signOut")}
            </button>
          </section>

          <section className="settings-section settings-danger">
            <h2>{t("settings", "deleteAccount")}</h2>
            <p>{t("settings", "deleteAccountDesc")}</p>
            <div className="settings-row">
              <button
                type="button"
                className={`settings-delete${confirmDelete ? " confirm" : ""}`}
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting
                  ? t("settings", "deleting")
                  : confirmDelete
                    ? t("settings", "clickAgainToConfirm")
                    : t("settings", "deleteMyAccount")}
              </button>
              {deleteNote && <span className="settings-note err">{deleteNote}</span>}
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>{t("common", "footerRights")}</span>
            <span>{t("common", "footerTagline")}</span>
            <span className="demo-label">{t("common", "yourWorkspace")}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

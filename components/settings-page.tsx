"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import Avatar from "@/components/avatar";
import { LakisaUploadProgress } from "@/components/lakisa-loader";
import { showToast } from "@/lib/toast";
import RedesignShell from "@/components/redesign-shell";
import LanguageSwitcher from "@/components/language-switcher";
import { LOCALE_TAGS, useLocale, useT } from "@/lib/i18n";
import { applyTheme, getStoredTheme, type ThemeChoice } from "@/lib/theme";
import { USER_ROLES } from "@/lib/validation";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

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
  user: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null; role: string | null; country: string | null; createdAt: string | null; exhibitionCount: number; isAdmin?: boolean };
}) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [role, setRole] = useState(user.role ?? "");
  const [country, setCountry] = useState(user.country ?? "");
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
    : "N/A";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileNote(null);
    setSavingProfile(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio.trim() === "" ? null : bio.trim(),
          role: role || undefined,
          country: country.trim() || undefined,
        }),
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
      showToast(t("settings", "avatarSaved"));
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
    <RedesignShell user={user} active="settings" exhibitionCount={user.exhibitionCount}>
      <div className={page.pageHead}>
        <div>
          <span className={dash.eyebrow}>{t("settings", "yourAccount")}</span>
          <h1>{t("settings", "title")}</h1>
          <p>{t("settings", "settingsDesc")}</p>
        </div>
      </div>

      <div className={page.sectionStack}>
        <section className={dash.card} aria-label={t("settings", "appearance")}>
          <div className={dash.cardHead}>
            <div>
              <h2>{t("settings", "appearance")}</h2>
              <p className={dash.cardSub}>{t("settings", "appearanceDesc")}</p>
            </div>
          </div>
          <div className={page.chips} style={{ marginTop: 12 }}>
            {(["light", "dark", "system"] as ThemeChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`${page.chip} ${theme === choice ? page.chipActive : ""}`}
                onClick={() => applyTheme(choice)}
                aria-pressed={theme === choice}
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

        <section className={dash.card} aria-label={t("settings", "language")}>
          <div className={dash.cardHead}>
            <div>
              <h2>{t("settings", "language")}</h2>
              <p className={dash.cardSub}>{t("settings", "languageDesc")}</p>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <LanguageSwitcher />
          </div>
        </section>

        <section className={dash.card} aria-label={t("settings", "profile")}>
          <div className={dash.cardHead}>
            <div>
              <h2>{t("settings", "profile")}</h2>
              <p className={dash.cardSub}>{t("settings", "profileDesc")}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <Avatar name={user.name} avatarUrl={avatarUrl} className="settings-avatar" />
            <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 240 }}>
              <strong style={{ fontSize: 16 }}>{user.name}</strong>
              <span className={dash.cardSub}>
                {t("settings", "memberSince")} {memberSince} · {user.exhibitionCount}{" "}
                {user.exhibitionCount === 1 ? t("settings", "exhibition") : t("settings", "exhibitions")}
              </span>
              <span className={page.formActions}>
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
                  className={page.btn}
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <LakisaUploadProgress progress={null} label={t("settings", "uploading")} />
                  ) : (
                    <>{t("settings", "uploadAvatar")}</>
                  )}
                </button>
                {avatarUrl && (
                  <button type="button" className={`${page.btn} ${page.btnDanger}`} disabled={uploadingAvatar} onClick={() => void removeAvatar()}>
                    {t("settings", "removeAvatar")}
                  </button>
                )}
                {avatarNote && (
                  <span style={{ color: avatarNote.ok ? "var(--rd-green)" : "var(--rd-red)", fontSize: 13 }}>
                    {avatarNote.text}
                  </span>
                )}
              </span>
              <small className={dash.cardSub}>{t("settings", "avatarHint")}</small>
              <span>
                <Link href={`/works/${user.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--rd-accent)", fontSize: 13 }}>
                  {t("works", "viewPublicPage")} ↗
                </Link>
              </span>
            </div>
          </div>
          <form onSubmit={saveProfile} style={{ marginTop: 20 }}>
            <div className={page.field}>
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
            <div className={page.field}>
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
            <div className={page.field}>
              <label htmlFor="settings-role">{t("auth", "yourRole")}</label>
              <select
                id="settings-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="">{t("auth", "chooseRole")}</option>
                {USER_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className={page.field}>
              <label htmlFor="settings-country">{t("auth", "country")}</label>
              <input
                id="settings-country"
                autoComplete="country-name"
                maxLength={80}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder={t("auth", "countryPlaceholder")}
              />
            </div>
            <div className={page.field}>
              <label htmlFor="settings-email">{t("settings", "email")}</label>
              <input id="settings-email" value={user.email} disabled />
              <small>{t("settings", "emailNote")}</small>
            </div>
            <div className={page.formActions}>
              <button type="submit" className={`${page.btn} ${page.btnCta}`} disabled={savingProfile}>
                {savingProfile ? t("settings", "saving") : t("settings", "saveChanges")}
              </button>
              {profileNote && (
                <span style={{ color: profileNote.ok ? "var(--rd-green)" : "var(--rd-red)", fontSize: 13 }}>
                  {profileNote.text}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className={dash.card} aria-label={t("settings", "password")}>
          <div className={dash.cardHead}>
            <div>
              <h2>{t("settings", "password")}</h2>
              <p className={dash.cardSub}>{t("settings", "passwordDesc")}</p>
            </div>
          </div>
          <form onSubmit={changePassword} style={{ marginTop: 16 }}>
            <div className={page.field}>
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
            <div className={page.field}>
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
            <div className={page.field}>
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
            <div className={page.formActions}>
              <button type="submit" className={`${page.btn} ${page.btnCta}`} disabled={savingPassword}>
                {savingPassword ? t("settings", "saving") : t("settings", "changePassword")}
              </button>
              {passwordNote && (
                <span style={{ color: passwordNote.ok ? "var(--rd-green)" : "var(--rd-red)", fontSize: 13 }}>
                  {passwordNote.text}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className={dash.card} aria-label={t("settings", "session")}>
          <div className={dash.cardHead}>
            <div>
              <h2>{t("settings", "session")}</h2>
              <p className={dash.cardSub}>{t("settings", "sessionDesc")}</p>
            </div>
          </div>
          <div className={page.formActions} style={{ marginTop: 12 }}>
            <button type="button" className={page.btn} onClick={signOut}>
              {t("common", "signOut")}
            </button>
          </div>
        </section>

        <section className={dash.card} aria-label={t("settings", "deleteAccount")} style={{ borderColor: "color-mix(in srgb, var(--rd-red) 45%, var(--rd-border))" }}>
          <div className={dash.cardHead}>
            <div>
              <h2 style={{ color: "var(--rd-red)" }}>{t("settings", "deleteAccount")}</h2>
              <p className={dash.cardSub}>{t("settings", "deleteAccountDesc")}</p>
            </div>
          </div>
          <div className={page.formActions} style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`${page.btn} ${page.btnDanger}`}
              onClick={deleteAccount}
              disabled={deleting}
            >
              {deleting
                ? t("settings", "deleting")
                : confirmDelete
                  ? t("settings", "clickAgainToConfirm")
                  : t("settings", "deleteMyAccount")}
            </button>
            {deleteNote && <span style={{ color: "var(--rd-red)", fontSize: 13 }}>{deleteNote}</span>}
          </div>
        </section>
      </div>
    </RedesignShell>
  );
}

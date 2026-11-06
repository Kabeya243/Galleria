"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, QrCode, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { useT } from "@/lib/i18n";

// Share (public exhibition): direct link (copy), QR code to open the
// exhibition on a phone, and the native share sheet when the browser
// offers one. The Open Graph tags for this exhibition live in
// generateMetadata (app/exhibition/[slug]/page.tsx), so a shared link
// unfurls with the exhibition's own title, description and image.
export default function ExhibitionShare({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the input below stays selectable.
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Dismissed or unavailable — the panel stays open.
    }
  }

  return (
    <div className="exhibition-share">
      <button
        type="button"
        className="public-info-button"
        aria-label={t("share", "share")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={16} />
      </button>
      {open && (
        <div className="share-panel" role="dialog" aria-label={t("share", "shareExhibition")}>
          <button type="button" className="info-close" onClick={() => setOpen(false)} aria-label={t("common", "close")}>
            <X size={16} />
          </button>
          <span className="panel-kicker">{t("share", "shareExhibition").toUpperCase()}</span>
          <h2>{title}</h2>
          <label className="share-link-row">
            <Link2 size={14} aria-hidden="true" />
            <div className="share-link-text" title={url} role="textbox" aria-readonly="true" aria-label={t("share", "copyLink")} tabIndex={0}>
              {url}
            </div>
            <button type="button" onClick={copyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("share", "linkCopied") : t("share", "copyLink")}
            </button>
          </label>
          {canNativeShare && (
            <button type="button" className="share-native" onClick={nativeShare}>
              <Share2 size={14} /> {t("share", "share")}
            </button>
          )}
          <div className="share-qr">
            {qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt={t("share", "scanToOpen")} width={160} height={160} />
                <span>
                  <QrCode size={14} aria-hidden="true" /> {t("share", "scanToOpen")}
                </span>
              </>
            ) : (
              !qrError && <span>{t("common", "loading")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

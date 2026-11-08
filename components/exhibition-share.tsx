"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, QrCode, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { buildEmbedSnippet, buildEmbedUrl, DEFAULT_EMBED_HEIGHT, DEFAULT_EMBED_WIDTH } from "@/lib/embed";
import { useT } from "@/lib/i18n";

// Share (public exhibition): direct link (copy), QR code to open the
// exhibition on a phone, and the native share sheet when the browser
// offers one. The Open Graph tags for this exhibition live in
// generateMetadata (app/exhibition/[slug]/page.tsx), so a shared link
// unfurls with the exhibition's own title, description and image.
//
// Embed: when the show is public (embeddable), the panel also offers
// the iframe code to paste on the artist's own site or a third-party
// site — same-origin src, no third-party JavaScript. Private-link and
// password-protected shows never offer it (embeddable is false).
export default function ExhibitionShare({
  title,
  url,
  slug,
  embeddable = false,
}: {
  title: string;
  url: string;
  slug?: string;
  embeddable?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const [embedWidth, setEmbedWidth] = useState(DEFAULT_EMBED_WIDTH);
  const [embedHeight, setEmbedHeight] = useState(DEFAULT_EMBED_HEIGHT);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [embedUrlCopied, setEmbedUrlCopied] = useState(false);
  const [embedCopyError, setEmbedCopyError] = useState<string | null>(null);

  const showEmbed = embeddable && Boolean(slug);
  const embedUrl = showEmbed
    ? buildEmbedUrl(typeof window !== "undefined" ? window.location.origin : "", slug as string)
    : "";
  const embedSnippet = showEmbed
    ? buildEmbedSnippet(embedUrl, { width: embedWidth, height: embedHeight }, title)
    : "";

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

  async function copyEmbed(what: "code" | "url") {
    setEmbedCopyError(null);
    try {
      await navigator.clipboard.writeText(what === "code" ? embedSnippet : embedUrl);
      if (what === "code") {
        setEmbedCopied(true);
        setTimeout(() => setEmbedCopied(false), 2000);
      } else {
        setEmbedUrlCopied(true);
        setTimeout(() => setEmbedUrlCopied(false), 2000);
      }
    } catch {
      // Clipboard unavailable — the code below stays selectable.
      setEmbedCopyError(t("embed", "embedCopyFailed"));
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
          {showEmbed && (
            <div className="share-embed">
              <span className="panel-kicker">{t("embed", "embedOnYourSite").toUpperCase()}</span>
              <p className="share-embed-hint">{t("embed", "embedHint")}</p>
              <label className="share-link-row">
                <Link2 size={14} aria-hidden="true" />
                <div className="share-link-text" title={embedUrl} role="textbox" aria-readonly="true" aria-label={t("embed", "embedUrl")} tabIndex={0}>
                  {embedUrl}
                </div>
                <button type="button" onClick={() => void copyEmbed("url")}>
                  {embedUrlCopied ? <Check size={14} /> : <Copy size={14} />}
                  {embedUrlCopied ? t("embed", "embedUrlCopied") : t("embed", "copyEmbedUrl")}
                </button>
              </label>
              <div className="share-embed-size">
                <label>
                  {t("embed", "embedWidth")}
                  <input
                    type="text"
                    value={embedWidth}
                    onChange={(event) => setEmbedWidth(event.target.value)}
                    aria-label={t("embed", "embedWidth")}
                  />
                </label>
                <label>
                  {t("embed", "embedHeight")}
                  <input
                    type="number"
                    min={200}
                    value={embedHeight}
                    onChange={(event) => setEmbedHeight(Number(event.target.value) || DEFAULT_EMBED_HEIGHT)}
                    aria-label={t("embed", "embedHeight")}
                  />
                </label>
              </div>
              <label className="share-embed-code">
                <textarea value={embedSnippet} readOnly rows={4} aria-label={t("embed", "embedOnYourSite")} />
              </label>
              <button type="button" className="share-embed-copy" onClick={() => void copyEmbed("code")}>
                {embedCopied ? <Check size={14} /> : <Copy size={14} />}
                {embedCopied ? t("embed", "embedCodeCopied") : t("embed", "copyEmbedCode")}
              </button>
              {embedCopyError && <p className="share-embed-error" role="alert">{embedCopyError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

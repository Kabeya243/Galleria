// /verify — public certificate verification. No sign-in, read-only:
// enter a certificate ID (or arrive via the QR code, ?id=…) and the
// page checks the ID against the issued certificates in the database.
// An authentic certificate shows its details; an unknown ID says so
// clearly and never invents a certificate.

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, CircleX } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { useT } from "@/lib/i18n";
import type { VerifiedCertificate } from "@/lib/certificate-verify";
import styles from "./verify-page.module.css";

type Status = "idle" | "checking" | "found" | "notFound" | "error";

export default function VerifyPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [certificate, setCertificate] = useState<VerifiedCertificate | null>(null);
  const [checkedId, setCheckedId] = useState("");
  const [errorKind, setErrorKind] = useState<"empty" | "unavailable" | null>(null);
  const didAutoCheck = useRef(false);

  const check = useCallback(async (rawId: string) => {
    const id = rawId.trim();
    if (!id) {
      setStatus("error");
      setCertificate(null);
      setCheckedId("");
      setErrorKind("empty");
      return;
    }
    setStatus("checking");
    setCheckedId(id.toUpperCase());
    try {
      const res = await fetch(`/api/verify-certificate?id=${encodeURIComponent(id)}`);
      const json = (await res.json().catch(() => null)) as
        | { found: true; certificate: VerifiedCertificate }
        | { found: false }
        | null;
      if (res.ok && json?.found) {
        setCertificate(json.certificate);
        setStatus("found");
      } else if (res.status === 404) {
        setCertificate(null);
        setStatus("notFound");
      } else {
        setCertificate(null);
        setStatus("error");
        setErrorKind("unavailable");
      }
    } catch {
      setCertificate(null);
      setStatus("error");
      setErrorKind("unavailable");
    }
  }, []);

  // Arriving via a QR code or a link (?id=…) checks the ID right away.
  useEffect(() => {
    const id = searchParams.get("id") ?? "";
    if (id && !didAutoCheck.current) {
      didAutoCheck.current = true;
      setInput(id);
      void check(id);
    }
  }, [searchParams, check]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await check(input);
  }

  const edition =
    certificate?.editionSize === "1"
      ? t("verify", "uniqueWork")
      : t("verify", "ofEdition")
          .replace("{n}", certificate?.editionNumber ?? "1")
          .replace("{size}", certificate?.editionSize ?? "1");
  const issuedOn = certificate
    ? new Date(certificate.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={52} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("verify", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("verify", "eyebrow")}</p>
        <h1 className={styles.title}>{t("verify", "title")}</h1>
        <p className={styles.intro}>{t("verify", "intro")}</p>
      </section>

      <section className={styles.body}>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            id="certificate-id"
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("verify", "idPlaceholder")}
            aria-label={t("verify", "idLabel")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.button} disabled={status === "checking"}>
            {status === "checking" ? t("verify", "checking") : t("verify", "check")}
          </button>
        </form>

        {status === "checking" && <p className={styles.checking}>{t("verify", "checking")}</p>}

        {status === "found" && certificate && (
          <div className={`${styles.result} ${styles.resultOk}`} role="status">
            <p className={`${styles.status} ${styles.statusOk}`}>
              <BadgeCheck size={26} /> {t("verify", "authentic")}
            </p>
            <p className={styles.statusText}>{t("verify", "authenticText")}</p>
            <dl className={styles.details}>
              {certificate.imageUrl && (
                <div className={styles.artworkImage}>
                  <dt>{t("verify", "artwork")}</dt>
                  <dd>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={certificate.imageUrl} alt={certificate.title} />
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("verify", "artwork")}</dt>
                <dd>{certificate.title || "—"}</dd>
              </div>
              <div>
                <dt>{t("verify", "artist")}</dt>
                <dd>{certificate.artist || "—"}</dd>
              </div>
              <div>
                <dt>{t("verify", "medium")}</dt>
                <dd>{certificate.medium || "—"}</dd>
              </div>
              <div>
                <dt>{t("verify", "dimensions")}</dt>
                <dd>{certificate.dimensions || "—"}</dd>
              </div>
              <div>
                <dt>{t("verify", "year")}</dt>
                <dd>{certificate.year || "—"}</dd>
              </div>
              <div>
                <dt>{t("verify", "edition")}</dt>
                <dd>{edition}</dd>
              </div>
              <div>
                <dt>{t("verify", "certificateId")}</dt>
                <dd>{certificate.certificateId}</dd>
              </div>
              <div>
                <dt>{t("verify", "issuedOn")}</dt>
                <dd>{issuedOn}</dd>
              </div>
            </dl>
          </div>
        )}

        {status === "notFound" && (
          <div className={`${styles.result} ${styles.resultBad}`} role="status">
            <p className={`${styles.status} ${styles.statusBad}`}>
              <CircleX size={26} /> {t("verify", "notFound")}
            </p>
            <p className={styles.statusText}>
              {t("verify", "notFoundText")} ({checkedId})
            </p>
          </div>
        )}

        {status === "error" && (
          <div className={`${styles.result} ${styles.resultBad}`} role="status">
            <p className={`${styles.status} ${styles.statusBad}`}>
              <CircleX size={26} /> {errorKind === "empty" ? t("verify", "emptyId") : t("verify", "notFound")}
            </p>
            <p className={styles.statusText}>
              {errorKind === "empty" ? t("verify", "intro") : t("verify", "unavailable")}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

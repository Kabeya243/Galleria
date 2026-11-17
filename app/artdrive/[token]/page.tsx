import { notFound } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/admin-data";

// ArtDrive share page: what anyone with the link sees, no account
// needed, like a Drive share link. Images and PDFs preview in the
// browser; everything else shows the file card with a download button.
export const metadata = {
  title: "Shared file: Lakisa ArtDrive",
  description: "A file shared with you on Lakisa ArtDrive. Open it or download it.",
};

function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export default async function ArtDriveSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const file = await db.artDriveFile.findUnique({ where: { token } });
  if (!file) notFound();

  const downloadUrl = `/api/artdrive/${token}/download`;
  const previewUrl = `${downloadUrl}?inline=1`;
  const sharedDate = file.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 48px",
        background: "var(--background, #0e0e0e)",
        color: "var(--foreground, #f5f5f5)",
      }}
    >
      <Link href="/" aria-label="Lakisa home" style={{ marginBottom: 28 }}>
        <BrandLogo variant="horizontal" height={36} />
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          border: "1px solid var(--border, rgba(255,255,255,0.14))",
          borderRadius: 16,
          overflow: "hidden",
          background: "var(--card, rgba(255,255,255,0.04))",
        }}
      >
        {isPreviewableImage(file.mimeType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.fileName}
            style={{ display: "block", width: "100%", maxHeight: "70vh", objectFit: "contain", background: "#000" }}
          />
        ) : isPdf(file.mimeType) ? (
          <iframe
            src={previewUrl}
            title={file.fileName}
            style={{ display: "block", width: "100%", height: "70vh", border: 0, background: "#fff" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
              fontSize: 56,
            }}
            aria-hidden
          >
            📄
          </div>
        )}

        <div style={{ padding: "20px 24px 24px" }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 6px",
              overflowWrap: "anywhere",
            }}
          >
            {file.fileName}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.7 }}>
            {formatBytes(file.size)} · Shared {sharedDate}
            {file.downloads > 0 ? ` · Downloaded ${file.downloads} time${file.downloads === 1 ? "" : "s"}` : ""}
          </p>
          <a
            href={downloadUrl}
            download={file.fileName}
            style={{
              display: "inline-block",
              padding: "12px 28px",
              borderRadius: 999,
              background: "#c9a227",
              color: "#111",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Download
          </a>
          <p style={{ margin: "16px 0 0", fontSize: 12, opacity: 0.55 }}>
            Shared with you on Lakisa ArtDrive. No account needed to download.
          </p>
        </div>
      </div>
    </main>
  );
}

import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3-compatible) object storage for artwork images.
// Images used to live in Postgres (the Upload table), which bloated the
// database and, worse, forced every upload through Vercel's 4.5 MB request
// body limit. New uploads go to R2 two ways: small files through the
// server proxy (/api/uploads/r2, same-origin, no CORS involved), heavy
// files straight to R2 with a presigned PUT URL (/api/uploads/presign,
// see lib/direct-upload.ts). The bucket needs a CORS policy for the
// direct path (PUT from the site origin, Content-Type header allowed).
// The stored URL is the same-origin serving URL either way
// (/api/r2/<key>), so textures load without CORS. Older images stay in
// the database and keep serving from /api/uploads/*.
//
// Required environment variables (Vercel: Production + Preview):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_BUCKET_NAME, R2_PUBLIC_URL (e.g. https://pub-xxxx.r2.dev)
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL,
  );
}

export function getR2Bucket(): string {
  return process.env.R2_BUCKET_NAME ?? "";
}

export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}

export function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

// The public URL of an artwork stored in R2. The key is always under
// uploads/<userId>/<uuid>.<ext>, so a stored image URL is easy to recognise.
export function isR2ImageUrl(url: string): boolean {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) return false;
  return url.startsWith(`${base}/uploads/`);
}

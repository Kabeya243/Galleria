// R2 storage for the Atelier editor — projects, uploads and user
// templates. Vercel's filesystem is ephemeral, so NOTHING is ever
// written to local disk: every file lives in the « sanaa » R2 bucket
// under atelier/<userId>/… (owner-scoped by key, checked on every
// read). Serving goes through /api/atelier/file/… (same-origin, so
// Fabric.js loads images with crossOrigin "anonymous" without CORS).

import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export function atelierProjectKey(userId: string, projectId: string): string {
  return `atelier/projects/${userId}/${projectId}.json`;
}

export function atelierProjectThumbKey(userId: string, projectId: string): string {
  return `atelier/projects/${userId}/${projectId}.jpg`;
}

export function atelierUploadKey(userId: string, fileName: string): string {
  return `atelier/uploads/${userId}/${fileName}`;
}

export function atelierTemplateKey(userId: string, templateId: string): string {
  return `atelier/templates/${userId}/${templateId}.json`;
}

export function atelierFileUrl(key: string): string {
  return `/api/atelier/file/${key}`;
}

export async function r2Put(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType, Body: body }),
  );
}

export async function r2Get(key: string): Promise<Uint8Array | null> {
  try {
    const res = await getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    if (!res.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch {
    return null;
  }
}

export async function r2Delete(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

export type R2Entry = { key: string; lastModified?: Date };

export async function r2List(prefix: string): Promise<R2Entry[]> {
  const entries: R2Entry[] = [];
  let token: string | undefined;
  do {
    const res = await getR2Client().send(
      new ListObjectsV2Command({ Bucket: getR2Bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) entries.push({ key: obj.Key, lastModified: obj.LastModified });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return entries;
}

export { isR2Configured };

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE_NAME = "sanaa_session";
const SESSION_DURATION = 60 * 60 * 24 * 30;
const SHORT_SESSION_DURATION = 60 * 60 * 24;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string, options?: { rememberMe?: boolean }) {
  const duration = options?.rememberMe === false ? SHORT_SESSION_DURATION : SESSION_DURATION;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${duration}s`)
    .sign(getSecret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: duration,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SESSION_SECRET")) {
      throw error;
    }
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, country: true },
  });
}

export function toClientArtwork(artwork: {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: number;
  scale: number;
  imageUrl: string | null;
  roomId: string;
}) {
  return {
    id: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    year: artwork.year,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    description: artwork.description,
    color: artwork.color,
    accent: artwork.accent,
    position: [artwork.positionX, artwork.positionY, artwork.positionZ] as [
      number,
      number,
      number,
    ],
    rotation: artwork.rotation,
    scale: artwork.scale,
    imageUrl: artwork.imageUrl,
    roomId: artwork.roomId,
  };
}

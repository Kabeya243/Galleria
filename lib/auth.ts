import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getUserProfile } from "@/lib/profile";
import { parsePalette } from "@/lib/palette";

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

export function isAdminEmail(email: string): boolean {
  // The admin area (CRM) is for the platform owner only — Kabeya. Access
  // is decided by email, listed in the ADMIN_EMAILS environment variable
  // (comma-separated, e.g. "kabeyailunga243@gmail.com").
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
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

  const [user, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, country: true },
    }),
    // Profile extras (avatar photo + bio) live in a SavedWork row, not on
    // the User table — see lib/profile.ts. One indexed query, merged here
    // so every page sees user.avatarUrl / user.bio.
    getUserProfile(userId),
  ]);
  if (!user) return null;
  // Carried on the user object so every page can show the Admin link
  // without threading a separate prop through the whole app.
  return { ...user, avatarUrl: profile.avatarUrl, bio: profile.bio, isAdmin: isAdminEmail(user.email) };
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
  frame?: string;
  imageUrl: string | null;
  text?: string | null;
  textFont?: string | null;
  palette?: string | null;
  altText?: string | null;
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
    frame: (artwork.frame as "none" | "wood" | "metal" | "gold" | "black" | "white" | undefined) ?? "wood",
    imageUrl: artwork.imageUrl,
    text: artwork.text ?? null,
    textFont: artwork.textFont ?? null,
    palette: parsePalette(artwork.palette ?? null),
    altText: artwork.altText ?? null,
    roomId: artwork.roomId,
  };
}

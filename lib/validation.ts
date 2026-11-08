import { z } from "zod";
import { isR2ImageUrl } from "@/lib/r2";
import { galleryRoomSchema } from "@/lib/rooms";
import { FRAME_VARIANTS } from "@/lib/demo-data";
import type { FrameVariant } from "@/lib/demo-data";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(72),
  rememberMe: z.boolean().optional(),
});

// Roles offered on the signup form — what the account does on SANAA.
export const USER_ROLES = [
  "Artist",
  "Curator",
  "Gallery",
  "Collector",
  "Art Advisor",
  "Institution",
  "Other",
] as const;

export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(60),
  password: z
    .string()
    .min(10)
    .max(72)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  // Optional: older clients and accounts created before these fields
  // existed send nothing, and the account still works.
  role: z.enum(USER_ROLES).optional(),
  country: z.string().trim().max(80).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  // Profile extras (avatar photo URL from the R2 upload proxy, short bio).
  // Stored in the "profile" SavedWork row, not on the User table — see
  // lib/profile.ts. Nullable so the avatar can be removed (null clears it).
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z
    .string()
    .min(10)
    .max(72)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

// --- Live password checks (registration form) ---------------------------
// The same rules as registrationSchema, exposed as booleans so the form
// can show each rule ticking off as the visitor types — no waiting for
// the server round-trip to learn a password is too short.
export type PasswordCheck = {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
};

export function passwordChecks(password: string): PasswordCheck {
  return {
    length: password.length >= 10,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.lowercase && checks.uppercase && checks.number;
}

const artworkSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  // Optional with an empty default: an artwork created before its
  // artist is typed (a fresh upload, a curatorial text) must never
  // block the save — the database column defaults to "" the same way,
  // and the public panel falls back to the exhibition owner's name.
  artist: z.string().max(120).optional().default(""),
  year: z.string().max(20),
  medium: z.string().max(160),
  dimensions: z.string().max(80),
  description: z.string().max(2000),
  color: z.string().regex(/^#[\da-f]{6}$/i),
  accent: z.string().regex(/^#[\da-f]{6}$/i),
  position: z.tuple([
    z.number().finite().min(-100).max(100),
    z.number().finite().min(-10).max(30),
    z.number().finite().min(-100).max(100),
  ]),
  rotation: z.number().finite().min(-Math.PI * 8).max(Math.PI * 8),
  scale: z.number().finite().min(0.1).max(5),
  // Frame finish around the artwork in the 3D room: any built-in
  // variant, or a custom Frame Studio configuration encoded as
  // "custom:<base64url JSON>" (see lib/demo-data.ts). The encoded form
  // is validated as a string here; the renderer falls back to wood for
  // anything it cannot decode, so a bad value never breaks the room.
  frame: z
    .union([
      z.enum(Object.keys(FRAME_VARIANTS) as [FrameVariant, ...FrameVariant[]]),
      z.string().regex(/^custom:[A-Za-z0-9_-]{1,2000}={0,2}$/),
    ])
    .default("wood"),
  // An artwork image is either a legacy database upload, a portfolio
  // image, a new R2 upload — served same-origin from /api/r2/... (the
  // raw R2 public URL cannot load as a WebGL texture: the bucket has no
  // CORS policy) — or the raw R2 public URL itself. Keep in sync with
  // isAllowedImageUrl in components/editor.tsx: the editor's pre-save
  // check and this server-side check must accept exactly the same
  // URLs, or a save the editor allows is rejected here.
  imageUrl: z
    .string()
    .refine(
      (url) =>
        /^\/api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp)|r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif))$/i.test(url) ||
        isR2ImageUrl(url),
      { message: "Invalid image URL." },
    )
    .nullable()
    .optional(),
  // Colour palette extracted from the artwork image (ColorThief, in the
  // browser): up to 8 hex colours, dominant first. Optional — older
  // artworks and artworks without an image have none, and the editor
  // computes it lazily on selection.
  palette: z
    .array(z.string().regex(/^#[0-9a-f]{6}$/i))
    .min(1)
    .max(8)
    .nullable()
    .optional(),
  // Alt-text for the artwork image (BLIP in the browser, or Gemini via
  // /api/describe when configured): a one-sentence description in
  // English, proposed at upload time and validated or corrected by the
  // artist before saving. Optional — older artworks have none until one
  // is generated or written.
  altText: z.string().trim().max(500).nullable().optional(),
  // Curatorial wall text (the reference room's "Texte curatorial"):
  // when set, the artwork is a canvas text panel, not an image, in one
  // of the four typefaces (d Bold display, s Clean sans, g Serif,
  // m Typewriter). Saved with the exhibition, like any artwork.
  text: z.string().trim().max(2000).nullable().optional(),
  textFont: z.enum(["d", "s", "g", "m"]).nullable().optional(),
  roomId: z.string().min(1).max(64),
});

export const exhibitionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  rooms: z.array(galleryRoomSchema).min(1).max(12),
  artworks: z.array(artworkSchema).max(100),
}).superRefine((exhibition, context) => {
  const roomIds = new Set(exhibition.rooms.map((room) => room.id));
  if (roomIds.size !== exhibition.rooms.length) {
    context.addIssue({ code: "custom", message: "Room IDs must be unique.", path: ["rooms"] });
  }
  exhibition.artworks.forEach((artwork, index) => {
    if (!roomIds.has(artwork.roomId)) {
      context.addIssue({
        code: "custom",
        message: "Every artwork must belong to an exhibition room.",
        path: ["artworks", index, "roomId"],
      });
    }
  });
});

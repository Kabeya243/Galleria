import { z } from "zod";
import { galleryRoomSchema } from "@/lib/rooms";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(72),
  rememberMe: z.boolean().optional(),
});

export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(60),
  password: z
    .string()
    .min(10)
    .max(72)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
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

const artworkSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  artist: z.string().max(120),
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
  imageUrl: z.string().regex(/^\/api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp))$/i).nullable().optional(),
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

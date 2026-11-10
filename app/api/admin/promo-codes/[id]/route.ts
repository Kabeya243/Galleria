import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";
import { normalizePromoCode } from "@/lib/promo-codes";

// Admin: edit one promo code, or deactivate it. Needs
// subscriptions.manage. The code itself can be renamed (it stays
// unique and uppercase); the use count is never edited by hand, it
// only grows from real uses.
const patchSchema = z.object({
  code: z.string().trim().min(3).max(20).optional(),
  discountType: z.enum(["percent", "free"]).optional(),
  discountValue: z.number().int().min(0).max(100).optional(),
  applicablePlanSlugs: z.array(z.enum(["discovery", "creator", "studio"])).optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  accessDurationDays: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminPermission("subscriptions.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the code fields and try again." }, { status: 400 });
  }
  const existing = await withDbRetry(() =>
    db.promoCode.findUnique({ where: { id }, select: { id: true, discountType: true } }),
  );
  if (!existing) {
    return NextResponse.json({ error: "That promo code does not exist." }, { status: 404 });
  }
  const nextType = parsed.data.discountType ?? existing.discountType;
  const nextValue = parsed.data.discountValue;
  if (nextType === "percent" && nextValue !== undefined && nextValue === 0) {
    return NextResponse.json(
      { error: "A percent code needs a discount above 0%." },
      { status: 400 },
    );
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.code !== undefined) data.code = normalizePromoCode(parsed.data.code);
  if (parsed.data.discountType !== undefined) data.discountType = parsed.data.discountType;
  if (parsed.data.discountValue !== undefined) data.discountValue = parsed.data.discountValue;
  if (parsed.data.applicablePlanSlugs !== undefined) {
    data.applicablePlanSlugs = parsed.data.applicablePlanSlugs;
  }
  if (parsed.data.maxUses !== undefined) data.maxUses = parsed.data.maxUses;
  if (parsed.data.expiresAt !== undefined) {
    data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.accessDurationDays !== undefined) {
    data.accessDurationDays = parsed.data.accessDurationDays;
  }
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  try {
    const updated = await withDbRetry(() =>
      db.promoCode.update({
        where: { id },
        data,
        include: { createdBy: { select: { name: true } } },
      }),
    );
    return NextResponse.json({
      promoCode: {
        id: updated.id,
        code: updated.code,
        discountType: updated.discountType,
        discountValue: updated.discountValue,
        applicablePlanSlugs: Array.isArray(updated.applicablePlanSlugs)
          ? (updated.applicablePlanSlugs as string[])
          : [],
        maxUses: updated.maxUses,
        usedCount: updated.usedCount,
        expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
        accessDurationDays: updated.accessDurationDays,
        isActive: updated.isActive,
        createdByName: updated.createdBy.name,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "That code already exists." }, { status: 409 });
    }
    throw error;
  }
}

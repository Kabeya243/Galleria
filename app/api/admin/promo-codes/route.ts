import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import { getAllPromoCodes, normalizePromoCode } from "@/lib/promo-codes";

// Admin promo codes: list every code with its uses, or create one.
// Readers need subscriptions.view; creating needs
// subscriptions.manage. A code is uppercase and unique; the discount
// is either a percentage off (discountValue 0-100) or free access for
// accessDurationDays. applicablePlanSlugs empty means every plan;
// maxUses empty means unlimited; expiresAt empty means never expires.
const createSchema = z.object({
  code: z.string().trim().min(3).max(20),
  discountType: z.enum(["percent", "free"]),
  discountValue: z.number().int().min(0).max(100),
  applicablePlanSlugs: z.array(z.enum(["discovery", "creator", "studio"])).default([]),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  accessDurationDays: z.number().int().min(1).max(365),
  isActive: z.boolean().optional().default(true),
});

function serialize(promo: Awaited<ReturnType<typeof getAllPromoCodes>>[number]) {
  return {
    ...promo,
    expiresAt: promo.expiresAt ? promo.expiresAt.toISOString() : null,
    createdAt: promo.createdAt.toISOString(),
  };
}

export async function GET() {
  const access = await requireAdminPermission("subscriptions.view");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const promos = await getAllPromoCodes();
  return NextResponse.json({ promoCodes: promos.map(serialize) });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("subscriptions.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the code fields and try again." }, { status: 400 });
  }
  const code = normalizePromoCode(parsed.data.code);
  if (parsed.data.discountType === "percent" && parsed.data.discountValue === 0) {
    return NextResponse.json(
      { error: "A percent code needs a discount above 0%." },
      { status: 400 },
    );
  }
  try {
    const created = await withDbRetry(() =>
      db.promoCode.create({
        data: {
          code,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          applicablePlanSlugs: parsed.data.applicablePlanSlugs,
          maxUses: parsed.data.maxUses ?? null,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          accessDurationDays: parsed.data.accessDurationDays,
          isActive: parsed.data.isActive,
          createdById: user.id,
        },
        include: { createdBy: { select: { name: true } } },
      }),
    );
    return NextResponse.json(
      {
        promoCode: serialize({
          id: created.id,
          code: created.code,
          discountType: created.discountType === "free" ? "free" : "percent",
          discountValue: created.discountValue,
          applicablePlanSlugs: Array.isArray(created.applicablePlanSlugs)
            ? (created.applicablePlanSlugs as string[])
            : [],
          maxUses: created.maxUses,
          usedCount: created.usedCount,
          expiresAt: created.expiresAt,
          accessDurationDays: created.accessDurationDays,
          isActive: created.isActive,
          createdByName: created.createdBy.name,
          createdAt: created.createdAt,
        }),
      },
      { status: 201 },
    );
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

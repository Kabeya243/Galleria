import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";

// Admin: edit one plan (name, prices, description, features, limits,
// active flag). Needs subscriptions.manage. The slug never changes: it
// is the stable key the code maps tools to. Validation is strict on
// shape (features are strings, limits are numbers or null) so a bad
// edit cannot break the pricing page. The seed defaults in
// lib/subscriptions.ts never overwrite an edit made here.
const limitsSchema = z
  .object({
    exhibitions: z.number().int().nonnegative().nullable().optional(),
    artworks: z.number().int().nonnegative().nullable().optional(),
    storageGb: z.number().int().nonnegative().nullable().optional(),
    contacts: z.number().int().nonnegative().nullable().optional(),
    inventory: z.number().int().nonnegative().nullable().optional(),
    aiActionsPerMonth: z.number().int().nonnegative().nullable().optional(),
  })
  .partial();

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    tagline: z.string().trim().max(120).optional(),
    description: z.string().trim().max(500).optional(),
    monthlyPriceUsd: z.number().min(0).max(100000).optional(),
    yearlyPriceUsd: z.number().min(0).max(1000000).optional(),
    singleMonthPriceUsd: z.number().min(0).max(100000).optional(),
    features: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
    limits: limitsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update." });

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan." }, { status: 400 });
  }
  const existing = await withDbRetry(() =>
    db.subscriptionPlan.findUnique({ where: { id } }),
  );
  if (!existing) {
    return NextResponse.json({ error: "That plan does not exist." }, { status: 404 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.tagline !== undefined) data.tagline = parsed.data.tagline;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.monthlyPriceUsd !== undefined) data.monthlyPriceUsd = parsed.data.monthlyPriceUsd;
  if (parsed.data.yearlyPriceUsd !== undefined) data.yearlyPriceUsd = parsed.data.yearlyPriceUsd;
  if (parsed.data.singleMonthPriceUsd !== undefined) data.singleMonthPriceUsd = parsed.data.singleMonthPriceUsd;
  if (parsed.data.features !== undefined) data.features = parsed.data.features;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.limits !== undefined) {
    const current = (existing.limits ?? {}) as Record<string, unknown>;
    data.limits = { ...current, ...parsed.data.limits };
  }
  const updated = await withDbRetry(() =>
    db.subscriptionPlan.update({ where: { id }, data }),
  );
  return NextResponse.json({
    plan: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      tagline: updated.tagline,
      description: updated.description,
      monthlyPriceUsd: updated.monthlyPriceUsd,
      yearlyPriceUsd: updated.yearlyPriceUsd,
      singleMonthPriceUsd: updated.singleMonthPriceUsd,
      features: updated.features,
      limits: updated.limits,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
    },
  });
}

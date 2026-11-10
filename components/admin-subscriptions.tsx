"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminChangePlanDialog, type AdminChangePayload } from "@/components/subscription-dialogs";
import type { PromoCodeDTO } from "@/lib/promo-codes";
import type { ReferralStats } from "@/lib/referrals";
import type { PlanDTO, PlanSlug } from "@/lib/subscriptions";

export type AdminSubscriptionRow = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  planId: string;
  planSlug: string;
  planName: string;
  status: string;
  billingCycle: string;
  source: string;
  startedAt: string;
  endsAt: string | null;
};

export type AdminPromoCode = Omit<PromoCodeDTO, "expiresAt" | "createdAt"> & {
  expiresAt: string | null;
  createdAt: string;
};

function formatLimit(value: number | null): string {
  if (value === null) return "Unlimited";
  return String(value);
}

function parseLimitInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

// Admin subscriptions section: every account's plan, the plan list with
// editing, the plan change flow, promo codes, and referrals. The manager
// (or a sub-admin with subscriptions.manage) changes a plan through a
// confirmation popup; the change is immediate and free while the paywall
// is off. Without the manage permission the tables are read-only.
export default function AdminSubscriptions({
  plans,
  subscriptions,
  promoCodes,
  referralStats,
  canManage,
}: {
  plans: PlanDTO[];
  subscriptions: AdminSubscriptionRow[];
  promoCodes: AdminPromoCode[];
  referralStats: ReferralStats;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [changing, setChanging] = useState<AdminSubscriptionRow | null>(null);
  const [targetPlanSlug, setTargetPlanSlug] = useState<PlanSlug>("creator");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanDTO | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    tagline: "",
    description: "",
    monthly: "",
    yearly: "",
    single: "",
    features: "",
    exhibitions: "",
    artworks: "",
    storageGb: "",
    contacts: "",
    inventory: "",
    aiActions: "",
    isActive: true,
  });
  // Promo codes (Nov 2026): create, edit and deactivate, with the
  // number of people each code brought (usedCount).
  const [promoFormOpen, setPromoFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<AdminPromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discountType: "percent" as "percent" | "free",
    discountValue: "10",
    planSlugs: [] as string[],
    maxUses: "",
    expiresAt: "",
    accessDurationDays: "30",
    isActive: true,
  });

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      subscriptions.filter(
        (s) =>
          needle === "" ||
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle) ||
          s.planName.toLowerCase().includes(needle),
      ),
    [subscriptions, needle],
  );

  function openChangeDialog(row: AdminSubscriptionRow, slug: PlanSlug) {
    if (slug === row.planSlug) return;
    setChangeError(null);
    setTargetPlanSlug(slug);
    setChanging(row);
  }

  async function confirmChange(payload: AdminChangePayload) {
    if (!changing) return;
    const res = await fetch(`/api/admin/subscriptions/${changing.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planSlug: targetPlanSlug,
        billingCycle: payload.billingCycle,
        endsAt: payload.endsAt,
        promoCode: payload.promoCode,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Could not change the plan.");
    }
    setChanging(null);
    router.refresh();
  }

  function startEdit(plan: PlanDTO) {
    setEditError(null);
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      tagline: plan.tagline,
      description: plan.description,
      monthly: String(plan.monthlyPriceUsd),
      yearly: String(plan.yearlyPriceUsd),
      single: String(plan.singleMonthPriceUsd),
      features: plan.features.join("\n"),
      exhibitions: plan.limits.exhibitions === null ? "" : String(plan.limits.exhibitions),
      artworks: plan.limits.artworks === null ? "" : String(plan.limits.artworks),
      storageGb: plan.limits.storageGb === null ? "" : String(plan.limits.storageGb),
      contacts: plan.limits.contacts === null ? "" : String(plan.limits.contacts),
      inventory: plan.limits.inventory === null ? "" : String(plan.limits.inventory),
      aiActions: plan.limits.aiActionsPerMonth === null ? "" : String(plan.limits.aiActionsPerMonth),
      isActive: plan.isActive,
    });
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPlan) return;
    const monthly = Number(editForm.monthly);
    const yearly = Number(editForm.yearly);
    const single = Number(editForm.single);
    if (
      !Number.isFinite(monthly) ||
      monthly < 0 ||
      !Number.isFinite(yearly) ||
      yearly < 0 ||
      !Number.isFinite(single) ||
      single < 0
    ) {
      setEditError("Prices must be numbers, zero or more.");
      return;
    }
    const limits: Record<string, number | null> = {};
    const entries: Array<[string, string]> = [
      ["exhibitions", editForm.exhibitions],
      ["artworks", editForm.artworks],
      ["storageGb", editForm.storageGb],
      ["contacts", editForm.contacts],
      ["inventory", editForm.inventory],
      ["aiActionsPerMonth", editForm.aiActions],
    ];
    for (const [key, raw] of entries) {
      const parsed = parseLimitInput(raw);
      if (parsed === undefined) {
        setEditError("Limits must be whole numbers, or empty for unlimited.");
        return;
      }
      limits[key] = parsed;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          tagline: editForm.tagline.trim(),
          description: editForm.description.trim(),
          monthlyPriceUsd: monthly,
          yearlyPriceUsd: yearly,
          singleMonthPriceUsd: single,
          features: editForm.features
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
          limits,
          isActive: editForm.isActive,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not save the plan.");
      }
      setEditingPlan(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save the plan.");
    } finally {
      setEditSaving(false);
    }
  }

  function startPromoCreate() {
    setPromoError(null);
    setEditingPromo(null);
    setPromoFormOpen(true);
    setPromoForm({
      code: "",
      discountType: "percent",
      discountValue: "10",
      planSlugs: [],
      maxUses: "",
      expiresAt: "",
      accessDurationDays: "30",
      isActive: true,
    });
  }

  function startPromoEdit(promo: AdminPromoCode) {
    setPromoError(null);
    setEditingPromo(promo);
    setPromoFormOpen(true);
    setPromoForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      planSlugs: promo.applicablePlanSlugs,
      maxUses: promo.maxUses === null ? "" : String(promo.maxUses),
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : "",
      accessDurationDays: String(promo.accessDurationDays),
      isActive: promo.isActive,
    });
  }

  function generatePromoCodeValue() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setPromoForm({ ...promoForm, code });
  }

  async function savePromo(event: React.FormEvent) {
    event.preventDefault();
    const code = promoForm.code.trim().toUpperCase();
    if (code.length < 3) {
      setPromoError("The code needs at least 3 characters.");
      return;
    }
    const discountValue = Number(promoForm.discountValue);
    if (
      promoForm.discountType === "percent" &&
      (!Number.isInteger(discountValue) || discountValue < 1 || discountValue > 100)
    ) {
      setPromoError("A percent code needs a discount from 1 to 100%.");
      return;
    }
    const maxUses = promoForm.maxUses.trim() === "" ? null : Number(promoForm.maxUses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      setPromoError("Max uses must be a whole number, or empty for unlimited.");
      return;
    }
    const accessDurationDays = Number(promoForm.accessDurationDays);
    if (!Number.isInteger(accessDurationDays) || accessDurationDays < 1 || accessDurationDays > 365) {
      setPromoError("Access duration must be 1 to 365 days.");
      return;
    }
    setPromoError(null);
    setPromoSaving(true);
    try {
      const payload = {
        code,
        discountType: promoForm.discountType,
        discountValue: promoForm.discountType === "free" ? 0 : discountValue,
        applicablePlanSlugs: promoForm.planSlugs,
        maxUses,
        expiresAt: promoForm.expiresAt ? new Date(`${promoForm.expiresAt}T00:00:00`).toISOString() : null,
        accessDurationDays,
        isActive: promoForm.isActive,
      };
      const res = await fetch(
        editingPromo ? `/api/admin/promo-codes/${editingPromo.id}` : "/api/admin/promo-codes",
        {
          method: editingPromo ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not save the promo code.");
      }
      setEditingPromo(null);
      setPromoFormOpen(false);
      router.refresh();
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Could not save the promo code.");
    } finally {
      setPromoSaving(false);
    }
  }

  async function togglePromoActive(promo: AdminPromoCode) {
    const res = await fetch(`/api/admin/promo-codes/${promo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promo.isActive }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setPromoError(data?.error ?? "Could not change the promo code.");
      return;
    }
    router.refresh();
  }

  const targetPlan = plans.find((p) => p.slug === targetPlanSlug) ?? null;

  return (
    <div>
      <div className="ad-section-head" style={{ marginTop: 28 }}>
        <h3>Plans</h3>
        <p>
          The three plans, with their prices and limits. Edit a plan to rename it, change a price
          or edit the included tools. The plan code (discovery, creator, studio) never changes: it
          is what the tools are tied to.
        </p>
      </div>
      <div className="ad-card ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Monthly</th>
              <th>Yearly</th>
              <th>One month</th>
              <th>Exhibitions</th>
              <th>Artworks</th>
              <th>Storage</th>
              <th>AI / month</th>
              <th>Status</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                  <br />
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{plan.tagline}</span>
                </td>
                <td>${plan.monthlyPriceUsd}</td>
                <td>${plan.yearlyPriceUsd}</td>
                <td>${plan.singleMonthPriceUsd}</td>
                <td>{formatLimit(plan.limits.exhibitions)}</td>
                <td>{formatLimit(plan.limits.artworks)}</td>
                <td>{plan.limits.storageGb === null ? "Unlimited" : `${plan.limits.storageGb} GB`}</td>
                <td>
                  {plan.limits.aiActionsPerMonth === null
                    ? "Unlimited"
                    : plan.limits.aiActionsPerMonth === 0
                      ? "Not included"
                      : plan.limits.aiActionsPerMonth}
                </td>
                <td>{plan.isActive ? "Active" : "Hidden"}</td>
                {canManage && (
                  <td>
                    <button type="button" className="ad-card-link" onClick={() => startEdit(plan)}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && editingPlan && (
        <form className="ad-card" onSubmit={saveEdit} style={{ marginTop: 16 }}>
          <div className="ad-card-head">
            <div>
              <h2>Edit plan: {editingPlan.name}</h2>
              <p className="ad-card-sub">Changes apply immediately to the pricing page and to new plan picks.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Name
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Tagline
              <input value={editForm.tagline} onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Description
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Monthly price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.monthly}
                  onChange={(e) => setEditForm({ ...editForm, monthly: e.target.value })}
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Yearly price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.yearly}
                  onChange={(e) => setEditForm({ ...editForm, yearly: e.target.value })}
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                One-month price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.single}
                  onChange={(e) => setEditForm({ ...editForm, single: e.target.value })}
                  required
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Features (one per line)
              <textarea
                value={editForm.features}
                onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
                rows={6}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {(
                [
                  ["exhibitions", "Exhibitions"],
                  ["artworks", "Artworks"],
                  ["storageGb", "Storage (GB)"],
                  ["contacts", "Contacts"],
                  ["inventory", "Inventory"],
                  ["aiActions", "AI / month"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  {label} (empty = unlimited)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              />
              Active (shown on the pricing page)
            </label>
            {editError && (
              <p role="alert" style={{ color: "#9a2b2b", fontSize: 14, margin: 0 }}>
                {editError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save plan"}
              </button>
              <button type="button" onClick={() => setEditingPlan(null)} disabled={editSaving}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="ad-section-head" style={{ marginTop: 28 }}>
        <h3>All subscriptions</h3>
        <p>
          {subscriptions.length} accounts with a plan. Change a plan to move an account between
          plans: a confirmation popup appears first, and the change is immediate.
        </p>
      </div>
      <form
        className="ad-search"
        onSubmit={(e) => e.preventDefault()}
        style={{ marginBottom: 12 }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or plan…"
          aria-label="Search subscriptions"
        />
      </form>
      {visible.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No subscriptions match.</p>
      ) : (
        <div className="ad-card ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Billing</th>
                <th>Since</th>
                {canManage && <th>Change plan</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.userId}>
                  <td>
                    {row.name}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.email}</span>
                  </td>
                  <td>
                    <strong>{row.planName}</strong>
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.source}</span>
                  </td>
                  <td>{row.status}</td>
                  <td>
                    {row.billingCycle}
                    {row.endsAt && (
                      <>
                        <br />
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                          ends {new Date(row.endsAt).toLocaleDateString("en-GB")}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{new Date(row.startedAt).toLocaleDateString("en-GB")}</td>
                  {canManage && (
                    <td>
                      <select
                        aria-label={`Change plan for ${row.name}`}
                        value={row.planSlug}
                        onChange={(e) => openChangeDialog(row, e.target.value as PlanSlug)}
                      >
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.slug}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ad-section-head" style={{ marginTop: 28 }}>
        <h3>Promo codes</h3>
        <p>
          Codes visitors apply in the plan-change popup, or the admin grants with a plan. A
          percent code takes a percentage off the price shown; a free code grants access for its
          duration, then the account returns to Discovery. One use per account per code. &ldquo;People
          brought&rdquo; is the real use count from the database.
        </p>
      </div>
      {promoError && (
        <p role="alert" style={{ color: "#9a2b2b", fontSize: 14 }}>
          {promoError}
        </p>
      )}
      {promoCodes.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No promo codes yet.</p>
      ) : (
        <div className="ad-card ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Plans</th>
                <th>Uses</th>
                <th>People brought</th>
                <th>Expires</th>
                <th>Access</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((promo) => (
                <tr key={promo.id}>
                  <td>
                    <strong>{promo.code}</strong>
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      by {promo.createdByName}
                    </span>
                  </td>
                  <td>
                    {promo.discountType === "free" ? "Free access" : `${promo.discountValue}% off`}
                  </td>
                  <td>
                    {promo.applicablePlanSlugs.length === 0
                      ? "All plans"
                      : promo.applicablePlanSlugs.join(", ")}
                  </td>
                  <td>
                    {promo.usedCount}
                    {promo.maxUses !== null ? ` / ${promo.maxUses}` : " (unlimited)"}
                  </td>
                  <td>{promo.usedCount}</td>
                  <td>
                    {promo.expiresAt
                      ? new Date(promo.expiresAt).toLocaleDateString("en-GB")
                      : "Never"}
                  </td>
                  <td>{promo.accessDurationDays} days</td>
                  <td>{promo.isActive ? "Active" : "Disabled"}</td>
                  {canManage && (
                    <td>
                      <button type="button" className="ad-card-link" onClick={() => startPromoEdit(promo)}>
                        Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="ad-card-link"
                        onClick={() => void togglePromoActive(promo)}
                      >
                        {promo.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={startPromoCreate}>
            Create a promo code
          </button>
        </div>
      )}
      {canManage && promoFormOpen && (
        <form className="ad-card" onSubmit={savePromo} style={{ marginTop: 16 }}>
          <div className="ad-card-head">
            <div>
              <h2>{editingPromo ? `Edit promo code: ${editingPromo.code}` : "Create a promo code"}</h2>
              <p className="ad-card-sub">
                No payment is connected, so a code reduces the price shown or grants free access.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Code
              <span style={{ display: "flex", gap: 8 }}>
                <input
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  required
                  minLength={3}
                  maxLength={20}
                  style={{ flex: 1, textTransform: "uppercase" }}
                />
                <button type="button" onClick={generatePromoCodeValue}>
                  Generate
                </button>
              </span>
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Discount type
                <select
                  value={promoForm.discountType}
                  onChange={(e) =>
                    setPromoForm({
                      ...promoForm,
                      discountType: e.target.value as "percent" | "free",
                    })
                  }
                >
                  <option value="percent">Percent off</option>
                  <option value="free">Free access</option>
                </select>
              </label>
              {promoForm.discountType === "percent" && (
                <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                  Discount (%)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={promoForm.discountValue}
                    onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
                    required
                  />
                </label>
              )}
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Access duration (days)
                <input
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  value={promoForm.accessDurationDays}
                  onChange={(e) => setPromoForm({ ...promoForm, accessDurationDays: e.target.value })}
                  required
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
              <span style={{ color: "var(--muted)" }}>Applies to:</span>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={promoForm.planSlugs.includes("creator")}
                  onChange={(e) =>
                    setPromoForm({
                      ...promoForm,
                      planSlugs: e.target.checked
                        ? [...promoForm.planSlugs, "creator"]
                        : promoForm.planSlugs.filter((s) => s !== "creator"),
                    })
                  }
                />
                Creator
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={promoForm.planSlugs.includes("studio")}
                  onChange={(e) =>
                    setPromoForm({
                      ...promoForm,
                      planSlugs: e.target.checked
                        ? [...promoForm.planSlugs, "studio"]
                        : promoForm.planSlugs.filter((s) => s !== "studio"),
                    })
                  }
                />
                Studio
              </label>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                (none ticked = all plans)
              </span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Max uses (empty = unlimited)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={promoForm.maxUses}
                  onChange={(e) => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14, flex: 1 }}>
                Expires on (empty = never)
                <input
                  type="date"
                  value={promoForm.expiresAt}
                  onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                />
              </label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={promoForm.isActive}
                onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })}
              />
              Active
            </label>
            {promoError && (
              <p role="alert" style={{ color: "#9a2b2b", fontSize: 14, margin: 0 }}>
                {promoError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={promoSaving}>
                {promoSaving ? "Saving…" : editingPromo ? "Save promo code" : "Create promo code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPromoFormOpen(false);
                  setEditingPromo(null);
                }}
                disabled={promoSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="ad-section-head" style={{ marginTop: 28 }}>
        <h3>Referrals</h3>
        <p>
          Every account has a referral code. When an invited friend takes a paid plan, the
          referrer earns 1 free month. All numbers below are counted from the database.
        </p>
      </div>
      {referralStats.byReferrer.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          No referrals yet. Referral codes are created at signup and on the &ldquo;My plan&rdquo;
          card.
        </p>
      ) : (
        <div className="ad-card ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Referrer</th>
                <th>Code</th>
                <th>People brought</th>
                <th>Paid conversions</th>
                <th>Rewards paid</th>
              </tr>
            </thead>
            <tbody>
              {referralStats.byReferrer.map((row) => (
                <tr key={row.referrerId}>
                  <td>
                    {row.referrerName}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.referrerEmail}</span>
                  </td>
                  <td>
                    <strong>{row.referralCode ?? "Not set yet"}</strong>
                  </td>
                  <td>{row.signups}</td>
                  <td>{row.paidConversions}</td>
                  <td>{row.rewarded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {referralStats.referrals.length > 0 && (
        <div className="ad-card ad-table-wrap" style={{ marginTop: 12 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Referred account</th>
                <th>Referrer</th>
                <th>Their plan now</th>
                <th>Status</th>
                <th>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {referralStats.referrals.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.referredName}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.referredEmail}</span>
                  </td>
                  <td>{row.referrerName}</td>
                  <td>{row.referredPlanSlug ?? "No plan yet"}</td>
                  <td>{row.status}</td>
                  <td>{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {changing && targetPlan && (
        <AdminChangePlanDialog
          userName={changing.name}
          userEmail={changing.email}
          currentPlanName={changing.planName}
          targetPlanName={targetPlan.name}
          onClose={() => {
            setChanging(null);
            setChangeError(null);
          }}
          onConfirm={confirmChange}
        />
      )}
      {changeError && (
        <p role="alert" style={{ color: "#9a2b2b", fontSize: 14 }}>
          {changeError}
        </p>
      )}
    </div>
  );
}

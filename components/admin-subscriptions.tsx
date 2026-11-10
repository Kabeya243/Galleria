"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminChangePlanDialog } from "@/components/subscription-dialogs";
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
// editing, and the plan change flow. The manager (or a sub-admin with
// subscriptions.manage) changes a plan through a confirmation popup; the
// change is immediate and free while the paywall is off. Without the
// manage permission the tables are read-only.
export default function AdminSubscriptions({
  plans,
  subscriptions,
  canManage,
}: {
  plans: PlanDTO[];
  subscriptions: AdminSubscriptionRow[];
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
    features: "",
    exhibitions: "",
    artworks: "",
    storageGb: "",
    contacts: "",
    inventory: "",
    aiActions: "",
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

  async function confirmChange() {
    if (!changing) return;
    const res = await fetch(`/api/admin/subscriptions/${changing.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug: targetPlanSlug }),
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
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(yearly) || yearly < 0) {
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
                  <td>{row.billingCycle}</td>
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

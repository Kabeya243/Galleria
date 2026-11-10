// Paid plans are hidden for now (Nov 2026). The pricing page shows
// only the free Discovery plan, with a note that the paid plans are
// coming soon; the locked-tool dialog says the same instead of
// offering a purchase; and the "My plan" card hides the plan-change
// controls. Nothing is deleted: the Creator and Studio plans stay in
// the database and the code (seed, server gates, admin assignment),
// and the paywall stays off, so every tool is free to try. Flip this
// to true when a payment provider is connected.
//
// Client-safe (no imports): the pricing page and the dialogs are
// client components, and lib/subscriptions.ts imports Prisma through
// lib/db, so this flag lives here instead of there.
export const SHOW_PAID_PLANS = false;

import { redirect } from "next/navigation";
import Link from "next/link";
import AdminDenied from "@/components/admin-denied";
import AdminOrderActions from "@/components/admin-order-actions";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminOrders,
} from "@/lib/admin-data";
import { paymentMethodLabel } from "@/lib/marketplace-sales";

export const metadata = {
  title: "Orders: Lakisa",
  description: "Every marketplace order, with the price, the Lakisa commission, the payment fee, the seller's share and the status.",
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function totalsText(totals: Array<{ currency: string; amount: number }>): string {
  return totals.length > 0
    ? totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ")
    : "0";
}

// Orders: every marketplace order, with the fee split and the
// platform totals. Automatic orders stay pending payment until
// Flutterwave is connected. Manual orders (Mobile Money or bank
// transfer, paid outside Lakisa) move to paid when the seller or an
// admin confirms receipt by hand, from this page or from the seller
// tool. The "Awaiting confirmation" filter shows the manual pending
// orders whose buyer already sent the transaction reference.
export default async function AdminOrdersRoute({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "orders.view")) redirect("/admin");
  const canManage = hasAdminPermission(access, "orders.manage");
  const { orders, totals, orderCount, awaitingConfirmation } = await loadAdminOrders();
  const filter = (await searchParams).filter === "awaiting" ? "awaiting" : "all";
  const visibleOrders =
    filter === "awaiting"
      ? orders.filter(
          (o) =>
            o.status === "pending_payment" &&
            (o.paymentMethod === "manual_momo" || o.paymentMethod === "manual_bank") &&
            o.paymentReference !== null,
        )
      : orders;
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="Orders"
        description={`${orderCount} marketplace orders, ${awaitingConfirmation} awaiting confirmation. The buyer pays Lakisa, Lakisa keeps its commission, pays the payment fee, and sends the rest to the seller. Automatic payments are not connected yet; manual payments (Mobile Money or bank transfer, outside Lakisa) are confirmed by hand here or in the seller tool, and carry no payment fee.`}
      />
      <div className="ad-section">
        <div className="ad-filter-row">
          <Link href="/admin/orders" className={filter === "all" ? "ad-filter-active" : ""}>
            All orders ({orderCount})
          </Link>
          <Link
            href="/admin/orders?filter=awaiting"
            className={filter === "awaiting" ? "ad-filter-active" : ""}
          >
            Awaiting confirmation ({awaitingConfirmation})
          </Link>
        </div>
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Commission collected</h2>
                <p className="ad-card-sub">Lakisa commission on live orders</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{totalsText(totals.commission)}</p>
          </section>
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>To pay out to sellers</h2>
                <p className="ad-card-sub">Seller share of orders whose payment cleared</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{totalsText(totals.toPayOut)}</p>
          </section>
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Waiting for payment</h2>
                <p className="ad-card-sub">Seller share of pending orders</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{totalsText(totals.waitingPayment)}</p>
          </section>
        </div>
        {visibleOrders.length === 0 ? (
          <EmptyBox
            title={filter === "awaiting" ? "No orders awaiting confirmation." : "No orders yet."}
            body={
              filter === "awaiting"
                ? "Manual pending orders appear here once the buyer sends the transaction reference."
                : "When a buyer pays for a work through Lakisa, the order and its fee split land here."
            }
          />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Work</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Price</th>
                  <th>Commission</th>
                  <th>Payment</th>
                  <th>Seller receives</th>
                  <th>Status</th>
                  <th>Placed</th>
                  {canManage && <th>Confirm</th>}
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/marketplace/${order.listingId}`}>{order.listingTitle}</Link>
                    </td>
                    <td>{order.buyerName}</td>
                    <td>{order.sellerName}</td>
                    <td>{formatMoney(order.finalPrice, order.currency)}</td>
                    <td>
                      {formatMoney(order.commissionAmount, order.currency)} ({Math.round(order.commissionRate * 100)}%)
                    </td>
                    <td>
                      {paymentMethodLabel(order.paymentMethod)}
                      {order.paymentFeeRate > 0 ? (
                        <>
                          {" "}
                          · {formatMoney(order.paymentFeeAmount, order.currency)} (
                          {Math.round(order.paymentFeeRate * 100)}%)
                        </>
                      ) : (
                        " · no fee"
                      )}
                      {order.paymentReference && (
                        <>
                          <br />
                          Ref: {order.paymentReference}
                        </>
                      )}
                    </td>
                    <td>{formatMoney(order.sellerNet, order.currency)}</td>
                    <td>
                      {order.status.replace(/_/g, " ")}
                      {order.status === "pending_payment" &&
                        (order.paymentMethod === "manual_momo" || order.paymentMethod === "manual_bank") &&
                        order.paymentReference !== null &&
                        " · awaiting confirmation"}
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString("en-GB")}</td>
                    {canManage && (
                      <td>
                        <AdminOrderActions
                          orderId={order.id}
                          paymentMethod={order.paymentMethod}
                          paymentReference={order.paymentReference}
                          status={order.status}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        .ad-filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .ad-filter-row a { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 12px; font-weight: 600; text-decoration: none; }
        .ad-filter-row a.ad-filter-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      `}</style>
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminOrders,
} from "@/lib/admin-data";

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
// platform totals. Until Flutterwave is connected every order sits
// in pending payment, so the collected and paid-out totals are zero
// and the pending total is the amount that will be due to sellers
// once payments clear.
export default async function AdminOrdersRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "orders.view")) redirect("/admin");
  const { orders, totals, orderCount } = await loadAdminOrders();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="Orders"
        description={`${orderCount} marketplace orders. The buyer pays Lakisa, Lakisa keeps its commission, pays the payment fee, and sends the rest to the seller. No payment provider is connected yet, so every order is pending payment and no money has moved.`}
      />
      <div className="ad-section">
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
        {orders.length === 0 ? (
          <EmptyBox
            title="No orders yet."
            body="When a buyer pays for a work through Lakisa, the order and its fee split land here."
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
                  <th>Payment fee</th>
                  <th>Seller receives</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
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
                      {formatMoney(order.paymentFeeAmount, order.currency)} (
                      {order.paymentMethod === "mobile_money" ? "Mobile Money" : "Card"},{" "}
                      {Math.round(order.paymentFeeRate * 100)}%)
                    </td>
                    <td>{formatMoney(order.sellerNet, order.currency)}</td>
                    <td>{order.status.replace(/_/g, " ")}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

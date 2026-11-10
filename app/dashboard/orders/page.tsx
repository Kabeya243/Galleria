import { redirect } from "next/navigation";
import OrdersList from "@/components/orders-list";
import Sidebar from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toClientOrder } from "@/lib/marketplace-sales";

export const metadata = {
  title: "My orders: Lakisa",
  description: "The works you bought and sold on the marketplace, with the fee split of each order.",
};

// "My orders" (Nov 2026): every marketplace order the user is part
// of, as buyer and as seller, with the fee split recorded at the time
// of the sale. Reached from the sidebar.
export default async function DashboardOrdersRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  const rows = await db.order.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="app-shell">
      <Sidebar user={user} active="orders" exhibitionCount={exhibitionCount} />

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">Marketplace</span>
              <h1>My orders</h1>
              <p className="welcome-copy">
                The works you bought and sold on Lakisa. The buyer pays Lakisa, Lakisa keeps its
                commission, pays the payment fee, and sends the rest to the seller. No payment
                provider is connected yet, so every order is pending payment and no money has
                moved.
              </p>
            </div>
          </div>

          <OrdersList orders={rows.map((row) => toClientOrder(row))} userId={user.id} />
        </div>
      </main>
    </div>
  );
}

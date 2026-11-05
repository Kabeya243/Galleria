import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Present & Sell — SANAA Tools",
  description: "Your published rooms as viewing rooms — share them, track visits, follow up.",
};

export default async function PresentSellRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [exhibitionCount, published] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id, status: "public" },
      include: { _count: { select: { artworks: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Present & Sell"
      eyebrow={`TOOLS · VIEWING ROOMS · ${published.length} PUBLISHED`}
      description="A published exhibition is already a viewing room: one link, the works on the wall, the visitor walks through it. Share the link, watch the visits, follow up while the work is still fresh in their mind."
    >
      {published.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No published viewing room yet.</strong>
          <p>Publish an exhibition and it appears here, ready to share with a collector or a curator.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <div className="galleries-grid">
          {published.map((exhibition) => (
            <article key={exhibition.id} className="gallery-card">
              <div className="gallery-card-body">
                <h3>
                  <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                </h3>
                <p>
                  {exhibition._count.artworks} {exhibition._count.artworks === 1 ? "artwork" : "artworks"} ·{" "}
                  {exhibition.views} {exhibition.views === 1 ? "visit" : "visits"}
                </p>
                <p className="gallery-card-finishes">galleria-bice.vercel.app/exhibition/{exhibition.slug}</p>
                <div className="gallery-card-actions">
                  <Link href={`/exhibition/${exhibition.slug}`} className="galleries-open-button">
                    Open the viewing room
                  </Link>
                  <Link href={`/editor/${exhibition.id}`} className="galleries-open-button">
                    Edit
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className={styles.resultNote}>
        A short checklist before you share: prices set on the works, the room hung the way you want it,
        and a note ready for the person you are sending it to.
      </p>
    </ToolsShell>
  );
}

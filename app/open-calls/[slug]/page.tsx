import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OpenCallForm from "@/components/open-call-form";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import { db } from "@/lib/db";

// Public open-call page: /open-calls/[slug]. No sign-in needed —
// applicants are the public. Only a published call whose deadline has
// not passed shows its form; drafts, closed and past-deadline calls
// show a plain "not available" page instead of leaking anything.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const call = await db.openCall.findUnique({ where: { slug }, select: { title: true, description: true } });
  if (!call) return { title: "Open call: Lakisa" };
  return {
    title: `${call.title}: Open call · Lakisa`,
    description: call.description || `Apply to ${call.title} on Lakisa.`,
  };
}

export default async function PublicOpenCallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const call = await db.openCall.findUnique({
    where: { slug },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  const closed = !call || call.status !== "published" || (call.deadline !== null && call.deadline.getTime() < Date.now());
  if (!call) notFound();
  if (closed) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <BrandLogo variant="horizontal" height={52} />
          </Link>
          <PublicNav links={[{ href: "/explore", label: "Exhibitions" }]} />
        </header>
        <div className="galleries-intro">
          <p className="eyebrow">
            <span className="status-dot" /> OPEN CALL
          </p>
          <h1>{call.title}</h1>
          <p>This open call is not accepting applications right now.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="galleries-page">
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} />
        </Link>
        <PublicNav links={[{ href: "/explore", label: "Exhibitions" }]} />
      </header>
      <div className="galleries-intro">
        <p className="eyebrow">
          <span className="status-dot" /> OPEN CALL
        </p>
        <h1>{call.title}</h1>
        {call.description && <p>{call.description}</p>}
        {call.deadline && (
          <p>
            Deadline:{" "}
            {call.deadline.toLocaleString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 60px" }}>
        <OpenCallForm
          slug={call.slug}
          fields={call.fields.map((f) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            options: Array.isArray(f.options) ? (f.options as string[]) : [],
          }))}
        />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OpenCallPageContent from "@/components/open-call-page";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import LanguageSwitcher from "@/components/language-switcher";
import { db } from "@/lib/db";
import { LAUNCH_OPEN_CALL_SLUG } from "@/lib/open-calls";

// Public launch open call: /open-call. The fixed, short URL printed
// on posters (with a QR code). No sign-in, no account needed to apply.
// It shows the launch call (slug "lakisa-launch", owned by the admin).
// The deadline, description and fields live in the OpenCall record and
// are edited in the Open Calls tool, so the page follows the record: a
// deadline set in the tool shows here, and until Kabeya sets one the
// page says the deadline is to be announced.
//
// The shell (header) is server-rendered; all translated content lives
// in the client component below, because lib/i18n.ts is client-only
// (it uses useSyncExternalStore) and a server component cannot import
// it. The server renders English first and the client corrects after
// hydration, like the rest of the site.
// The page reads the live OpenCall record (deadline, description and
// fields are edited in the Open Calls tool), so it is rendered on
// demand, not prerendered at build time: a static prerender would
// freeze the record as of the build and would also fail the local
// build, whose .env DATABASE_URL is only a placeholder.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const call = await db.openCall.findUnique({
    where: { slug: LAUNCH_OPEN_CALL_SLUG },
    select: { title: true, description: true },
  });
  return {
    title: call ? `${call.title} · Lakisa` : "Open Call · Lakisa",
    description:
      call?.description || "Lakisa is open. A call for young artists.",
  };
}

export default async function LaunchOpenCallPage() {
  const call = await db.openCall.findUnique({
    where: { slug: LAUNCH_OPEN_CALL_SLUG },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!call) notFound();
  const closed =
    call.status !== "published" ||
    (call.deadline !== null && call.deadline.getTime() < Date.now());

  return (
    <main className="galleries-page">
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} />
        </Link>
        <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <PublicNav links={[{ href: "/explore", label: "Exhibitions" }]} />
          <LanguageSwitcher />
        </span>
      </header>
      <OpenCallPageContent
        slug={call.slug}
        deadline={call.deadline?.toISOString() ?? null}
        closed={closed}
        fields={call.fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          options: Array.isArray(f.options) ? (f.options as string[]) : [],
        }))}
      />
    </main>
  );
}

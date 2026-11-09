import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function NotFound() {
  return (
    <main className="not-found">
      <span className="brand-lockup">
        <BrandLogo variant="horizontal" height={40} />
      </span>
      <p className="eyebrow">404 · NOT FOUND</p>
      <h1>
        This room does not exist<span className="title-period">.</span>
      </h1>
      <p>The page you are looking for has moved, or it never existed.</p>
      <Link className="primary-button" href="/">
        Back to the dashboard
      </Link>
    </main>
  );
}

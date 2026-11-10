import Link from "next/link";

// The access-denied panel every admin page renders for a signed-in
// account without admin access (moved verbatim from the old single
// admin page). Signed-out visitors never see it: requireAdminAccess
// redirects them to /login first.
export default function AdminDenied({ user }: { user: { name: string | null; email: string } }) {
  return (
    <main className="ad-root">
      <div className="ad-denied">
        <h1>Admin access required</h1>
        <p>
          This area is for the Lakisa manager and sub-admins. You are
          signed in as {user.name ?? user.email}, and this account does
          not have admin access.
        </p>
        <Link href="/" className="ad-denied-link">
          Back to your dashboard
        </Link>
      </div>
    </main>
  );
}

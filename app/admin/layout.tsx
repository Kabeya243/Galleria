import type { ReactNode } from "react";
import AdminShell from "@/components/admin-shell";
import {
  adminSections,
  getAdminContext,
  loadAdminShellCounts,
} from "@/lib/admin-data";

// Runs before first paint: reads the stored admin theme (default dark) and
// the stored sidebar state, and sets them on <html> as data attributes, so
// the Admin never flashes the wrong theme or the wrong sidebar width on
// load. Separate from the app's own sanaa-theme. With no stored choice the
// sidebar starts expanded on desktop and closed (drawer) on small screens.
const adminThemeScript = `(function(){try{var t=localStorage.getItem('sanaa-admin-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-admin-theme',t);}catch(e){document.documentElement.setAttribute('data-admin-theme','dark');}try{var c=localStorage.getItem('sanaa-admin-collapsed');if(c!=='true'&&c!=='false')c=window.innerWidth<760?'true':'false';document.documentElement.setAttribute('data-admin-collapsed',c);}catch(e){document.documentElement.setAttribute('data-admin-collapsed','false');}})();`;

// The Admin shell (sidebar + top bar) is mounted ONCE here, in the shared
// layout, and stays mounted while the visitor moves between admin pages:
// clicking a menu item only swaps the page content below, the sidebar
// never unmounts, never reloads and never moves. Each admin page keeps
// its own permission checks and renders its own heading (AdminHero) and
// content inside the shell. A signed-in account without admin access gets
// no shell at all: the page renders its access-denied panel instead.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
        {children}
      </>
    );
  }
  const counts = await loadAdminShellCounts();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
      <AdminShell user={user} counts={counts} sections={adminSections(access)}>
        {children}
      </AdminShell>
    </>
  );
}

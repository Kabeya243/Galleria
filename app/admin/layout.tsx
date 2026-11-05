import type { ReactNode } from "react";

// Runs before first paint: reads the stored admin theme (default dark) and
// sets it on <html> as data-admin-theme, so the Admin never flashes the
// wrong theme on load. Separate from the app's own sanaa-theme.
const adminThemeScript = `(function(){try{var t=localStorage.getItem('sanaa-admin-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-admin-theme',t);}catch(e){document.documentElement.setAttribute('data-admin-theme','dark');}})();`;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
      {children}
    </>
  );
}

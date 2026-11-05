import type { ReactNode } from "react";

// Runs before first paint: reads the stored admin theme (default dark) and
// the stored sidebar state, and sets them on <html> as data attributes, so
// the Admin never flashes the wrong theme or the wrong sidebar width on
// load. Separate from the app's own sanaa-theme. With no stored choice the
// sidebar starts expanded on desktop and closed (drawer) on small screens.
const adminThemeScript = `(function(){try{var t=localStorage.getItem('sanaa-admin-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-admin-theme',t);}catch(e){document.documentElement.setAttribute('data-admin-theme','dark');}try{var c=localStorage.getItem('sanaa-admin-collapsed');if(c!=='true'&&c!=='false')c=window.innerWidth<760?'true':'false';document.documentElement.setAttribute('data-admin-collapsed',c);}catch(e){document.documentElement.setAttribute('data-admin-collapsed','false');}})();`;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
      {children}
    </>
  );
}

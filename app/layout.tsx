import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SANAA — Your art, in another space",
  description:
    "Create, curate and share your own immersive virtual art exhibitions.",
};

const themeScript = `(function(){try{var c=localStorage.getItem('sanaa-theme')||'system';var d=c==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import LakisaToast from "@/components/lakisa-toast";
import CookieBanner from "@/components/cookie-banner";
import "@/components/advanced-site-editor.css";
import "@/components/advanced-site-published.css";

// Clean white-gallery typography: Fraunces (light serif headlines) + DM Sans (body/UI).
// Fonts self-hosted (variable woff2, latin subset) so the build no longer
// depends on downloading from Google Fonts.
const fraunces = localFont({
  src: [
    {
      path: "./fonts/fraunces-variable.woff2",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-italic-variable.woff2",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-display",
});
const dmSans = localFont({
  src: "./fonts/dm-sans-variable.woff2",
  variable: "--font-body",
  weight: "400 700",
});

export const metadata: Metadata = {
  title: "Lakisa: Your art, in another space",
  description:
    "Create, curate and share your own immersive virtual art exhibitions.",
};

const themeScript = `(function(){try{var c=localStorage.getItem('sanaa-theme');if(!c){var m=document.cookie.match(/(?:^|; )sanaa-theme=(light|dark|system)/);c=m?m[1]:'system';}var d=c==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <LakisaToast />
        <CookieBanner />
      </body>
    </html>
  );
}

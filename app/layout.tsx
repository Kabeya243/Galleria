import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import LakisaToast from "@/components/lakisa-toast";
import CookieBanner from "@/components/cookie-banner";
import MobileBurger from "@/components/mobile-burger";
import PwaRegister from "@/components/pwa-register";
import { SITE_URL } from "@/components/seo-jsonld";
import { getCurrentUser } from "@/lib/auth";
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

export const viewport: Viewport = {
  // Brand black, matching the Lakisa logo and the PWA theme colour.
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lakisa: Your art, in another space",
  description:
    "Create, curate and share your own immersive virtual art exhibitions.",
  // PWA: the manifest (app/manifest.ts, served at /manifest.webmanifest)
  // makes Lakisa installable on desktop from Chrome/Edge.
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  // No title template here on purpose: the public pages already set
  // full titles ending in ": Lakisa" ("About: Lakisa", "Feed: Lakisa"),
  // and a template would suffix them a second time.
  // No global canonical either: one canonical in the layout would be
  // inherited by every page. Per-page canonicals belong in each page's
  // own metadata, via canonicalUrl() / languageAlternates() from
  // components/seo-jsonld.tsx.
  openGraph: {
    type: "website",
    locale: "en",
    url: SITE_URL,
    siteName: "Lakisa",
    title: "Lakisa: Your art, in another space",
    description:
      "Create, curate and share your own immersive virtual art exhibitions.",
    images: [
      {
        url: "/brand/lakisa-horizontal-noir.png",
        width: 2800,
        height: 1200,
        alt: "Lakisa",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lakisa: Your art, in another space",
    description:
      "Create, curate and share your own immersive virtual art exhibitions.",
    images: ["/brand/lakisa-horizontal-noir.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeScript = `(function(){try{var c=localStorage.getItem('sanaa-theme');if(!c){var m=document.cookie.match(/(?:^|; )sanaa-theme=(light|dark|system)/);c=m?m[1]:'system';}var d=c==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Global mobile burger: the auth state decides which links the menu
  // shows. A failed lookup (no session, DB hiccup) just shows the
  // signed-out links; it must never take the layout down.
  let signedIn = false;
  try {
    signedIn = (await getCurrentUser()) !== null;
  } catch {
    signedIn = false;
  }
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <PwaRegister />
        <MobileBurger signedIn={signedIn} />
        {children}
        <LakisaToast />
        <CookieBanner />
      </body>
    </html>
  );
}

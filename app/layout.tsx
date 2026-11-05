import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// Clean white-gallery typography: Fraunces (light serif headlines) + DM Sans (body/UI).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

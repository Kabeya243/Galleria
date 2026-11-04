import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SANAA — Your art, in another space",
  description:
    "Create, curate and share your own immersive virtual art exhibitions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

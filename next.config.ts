import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // AVIF first, WebP fallback: smaller files for the same quality
    // whenever an image goes through next/image.
    formats: ["image/avif", "image/webp"],
    // Artwork images can arrive as absolute R2 public URLs
    // (https://pub-....r2.dev/...); same-origin serving (/api/r2/...)
    // needs no remote pattern. The wildcard covers any R2 public host
    // without hardcoding the bucket's subdomain.
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;

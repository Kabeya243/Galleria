import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest). Makes Lakisa
// installable on desktop from Chrome/Edge: an app icon on the desktop,
// its own window, and offline access to the cached static shell.
// Brand colours are black, matching the Lakisa logo (white wireframe
// cube on black). English is the site's default language.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lakisa",
    short_name: "Lakisa",
    description:
      "Create, curate and share your own immersive virtual art exhibitions.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "en",
    categories: ["art", "entertainment", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

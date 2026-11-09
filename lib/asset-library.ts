// Image-to-3D & Asset Library — shared types, provider adapter interface
// and validation helpers. The tool itself lives in
// components/image-to-3d.tsx; this module holds everything that does not
// depend on React so the adapter can be reused (and unit-tested) on its own.
//
// Honest scope: a single image cannot reconstruct hidden geometry. What
// SANAA does client-side is a depth-from-luminance approximation and a
// 2D-texture mode. True multi-view reconstruction and photogrammetry need
// an external service — the adapter interface below is the slot for one.

// ---------------------------------------------------------------------------
// Asset records (persisted as SavedWork kind "asset-3d")
// ---------------------------------------------------------------------------

export const ASSET_LICENSES = [
  "CC0 — Public Domain",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "Fab Standard — Personal",
  "Fab Standard — Professional",
  "Fab Standard — tier not confirmed",
  "Royalty-free (check terms)",
  "All rights reserved",
  "Unknown — do not use commercially",
] as const;

export type AssetLicense = (typeof ASSET_LICENSES)[number];

/** Licences a Fab listing can carry (Epic's Fab docs: "Creative Commons
 *  Attribution (CC-BY) (Free)" and "Standard (Free or For Sale)"). The
 *  Standard License has Personal / Professional price tiers — Professional
 *  applies once the buyer has generated more than $100,000 USD gross
 *  revenue from commercial activity in the last 12 months. The two tiers
 *  grant the same scope of rights; the tier is about which price applies.
 *  "Free" on Fab does not mean "usable for anything": always read the
 *  licence on the listing itself. */
export const FAB_LICENSES: AssetLicense[] = [
  "Fab Standard — Personal",
  "Fab Standard — Professional",
  "Fab Standard — tier not confirmed",
  "CC BY 4.0",
];

/** Fab Standard License does not require attribution ("You are not
 *  required to give credit to the publisher you acquired the Fab asset
 *  from", Fab EULA); CC-BY does — appropriate credit, a link to the
 *  licence, and an indication of changes. */
export function fabLicenseRequiresAttribution(license: AssetLicense): boolean {
  return license.startsWith("CC BY");
}

export const ASSET_SOURCES = ["upload", "image-to-3d", "reference-link", "manual", "fab"] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

export const ASSET_KINDS = ["model", "texture", "image", "reference"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** One asset in the personal library. `fileDataUrl` is only ever kept for
 *  small image-to-3D textures; an imported GLB IS stored server-side
 *  (R2, sculptures/<userId>/<uuid>.glb — see lib/sculpture.ts) and the
 *  record keeps its same-origin serving URL in `sculptureUrl`, so the
 *  model can be added to an exhibition from here. Never claim an asset
 *  is free to use without its license. */
export interface Asset3DRecord {
  kind: AssetKind;
  source: AssetSource;
  name: string;
  creator: string;
  license: AssetLicense;
  attribution: string;
  downloadDate: string; // ISO date
  fileName?: string;
  fileSizeBytes?: number;
  fileType?: string;
  /** 2D-texture / depth-approximation payloads only (data URLs). */
  fileDataUrl?: string;
  /** Imported GLB: the same-origin serving URL (/api/sculpture/…),
   *  set once the file is stored in R2. */
  sculptureUrl?: string;
  mode?: "2d-texture" | "depth-approximation" | "imported-glb" | "reference";
  /** Transform applied in the preview viewer. */
  transform?: { scale: number; rotationY: number; tint: string };
  depthStrength?: number;
  sourceUrl?: string;
  notes?: string;
  // --- Fab catalogue fields (source "fab" only). SANAA catalogues the
  // metadata and links out to fab.com — it never copies, hotlinks or
  // re-hosts Fab files, and there is no public Fab download API. ---
  /** "free" = listed free on Fab; "paid" = requires purchase. Paid assets
   *  are labelled PAID in the UI and are never included by default. */
  price?: "free" | "paid";
  /** Price as shown on the Fab listing, e.g. "$12.00" (paid only). */
  priceAmount?: string;
  /** File format as listed on Fab, e.g. GLB, FBX, OBJ, USD. */
  format?: string;
  /** Triangle / polygon count, when the listing states one. */
  polyCount?: number;
}

export const MAX_ASSET_FILE_BYTES = 50 * 1024 * 1024; // 50 MB, same as R2 uploads

export const ACCEPTED_MODEL_TYPES = [".glb", ".gltf"];
export const ACCEPTED_IMAGE_TYPES = [".jpg", ".jpeg", ".png", ".webp"];

export function validateAssetFile(file: File, allowedExtensions: string[]): string | null {
  const lower = file.name.toLowerCase();
  if (!allowedExtensions.some((ext) => lower.endsWith(ext))) {
    return `“${file.name}” is not a supported file. Accepted: ${allowedExtensions.join(", ")}.`;
  }
  if (file.size > MAX_ASSET_FILE_BYTES) {
    return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 50 MB.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Reference links — links out only, never hotlinked or re-hosted. Licenses
// are stated exactly as each source publishes them. The first list is
// free / public-domain sources; the second is marketplaces where each asset
// carries its own licence and price — SANAA records the asset URL and
// licence, it never copies or re-hosts the file.
// ---------------------------------------------------------------------------

export interface ReferenceLink {
  name: string;
  url: string;
  license: string;
  what: string;
}

export const PUBLIC_DOMAIN_REFERENCES: ReferenceLink[] = [
  {
    name: "Poly Haven",
    url: "https://polyhaven.com/models",
    license: "CC0 — Public Domain",
    what: "Free 3D models, HDRIs and textures. No attribution required, commercial use allowed.",
  },
  {
    name: "Smithsonian Open Access",
    url: "https://www.si.edu/openaccess",
    license: "CC0 — Public Domain",
    what: "Millions of 2D and 3D assets from the Smithsonian collections, released as CC0.",
  },
  {
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/wiki/Category:3D_models",
    license: "Varies per file — check each file's licence page",
    what: "Freely licensed 3D models and images. Always read the licence on the file page before use.",
  },
  {
    name: "Sketchfab",
    url: "https://sketchfab.com/search?q=&type=models&licenses=7",
    license: "Varies per model — filter by licence (CC0 / CC BY)",
    what: "Downloadable models. Use the licence filter and respect each model's terms; many are not free.",
  },
];

/** Marketplaces — link out only. Each asset has its own licence and price;
 *  record the Fab asset URL and its licence in the library like any other
 *  source, and never re-host the file.
 *
 *  Fab (fab.com) is Epic Games' marketplace for 3D models, textures,
 *  materials, environments and more — launched October 2024 as the successor
 *  to the Unreal Engine Marketplace, the Sketchfab Store, Quixel and the
 *  ArtStation Marketplace. Assets are acquired on fab.com, in the Epic Games
 *  Launcher, or through the Fab plugin for Unreal Engine / UEFN. Licences
 *  are per asset: Creative Commons Attribution (CC-BY, free) or the Fab
 *  Standard License (Personal or Professional tiers — Professional applies
 *  once the buyer has generated more than $100,000 USD gross revenue from
 *  commercial activity in the last 12 months; check the licence on the
 *  asset's own page before use).
 *
 *  There is no public Fab download API: assets are acquired by hand on
 *  fab.com / in the Launcher / in the UE plugin. Publishing assets to Fab
 *  needs a Fab publisher account, which is created with an Epic Games
 *  account (see the Epic developer docs). No Fab credential or API key is
 *  ever pasted into SANAA. */
export const MARKETPLACE_REFERENCES: ReferenceLink[] = [
  {
    name: "Fab (Epic Games)",
    url: "https://www.fab.com",
    license: "Varies per asset — Fab Standard License (Personal / Professional) or CC-BY",
    what: "Epic's marketplace for 3D models, textures, materials and environments. Link out only: browse and acquire each asset on fab.com under its own licence and price — Lakisa does not copy, hotlink or re-host Fab files, and there is no public Fab download API.",
  },
];

// ---------------------------------------------------------------------------
// Image-to-3D provider adapter
// ---------------------------------------------------------------------------

export type Image3DMode =
  | "2d-texture"
  | "depth-approximation"
  | "multi-view"
  | "photogrammetry"
  | "ai-geometry";

export const IMAGE3D_MODES: {
  id: Image3DMode;
  label: string;
  available: boolean;
  description: string;
}[] = [
  {
    id: "2d-texture",
    label: "2D texture",
    available: true,
    description:
      "The image is applied as a texture on a box or plane. The object is flat — this is a textured panel, not a 3D model.",
  },
  {
    id: "depth-approximation",
    label: "Depth approximation",
    available: true,
    description:
      "Brightness is read as height and the image is displaced into a relief. An artistic approximation: bright areas rise, dark areas sink. It cannot know what is behind the subject.",
  },
  {
    id: "multi-view",
    label: "Multi-view reconstruction",
    available: false,
    description:
      "Needs several photos of the same object from different angles. Not available without an external reconstruction service.",
  },
  {
    id: "photogrammetry",
    label: "Photogrammetry",
    available: false,
    description:
      "Needs a photo set (typically 20+ overlapping shots) and a photogrammetry pipeline. Not available without an external service.",
  },
  {
    id: "ai-geometry",
    label: "AI geometry",
    available: false,
    description:
      "A hosted AI model that infers 3D geometry from one image. Not available without an external service and API key.",
  },
];

export interface Image3DOptions {
  mode: Image3DMode;
  /** Depth relief strength (0–1) for the depth-approximation mode. */
  depthStrength?: number;
  /** Target mesh resolution for the depth relief (segments per side). */
  segments?: number;
}

export interface Image3DResult {
  /** "none" providers return a client-side approximation; external
   *  providers return a downloadable model URL. */
  provider: string;
  mode: Image3DMode;
  /** GLB/GLTF download URL when an external provider produced a model. */
  modelUrl?: string;
  /** Data URL of the source image (used by the client-side modes). */
  imageDataUrl?: string;
  note: string;
}

export interface Image3DProvider {
  id: string;
  label: string;
  /** True when this provider can actually run in the current environment. */
  available(): boolean;
  /** What the user must do to enable it (env vars, account, pricing). */
  setupInstructions(): string;
  generateFromImage(image: Blob, options: Image3DOptions): Promise<Image3DResult>;
}

/** The built-in provider: no external service, no API key. Implements the
 *  two client-side modes honestly and refuses the three that need a
 *  reconstruction service. */
export const localApproximationProvider: Image3DProvider = {
  id: "none",
  label: "Local approximation (no external service)",
  available: () => true,
  setupInstructions: () =>
    "No setup needed. This provider runs entirely in your browser: 2D texture and depth approximation only. For multi-view reconstruction, photogrammetry or AI geometry, connect an external service below.",
  async generateFromImage(image, options) {
    if (options.mode !== "2d-texture" && options.mode !== "depth-approximation") {
      throw new Error(
        `“${options.mode}” needs an external reconstruction service. The local provider only does 2D texture and depth approximation.`,
      );
    }
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the image."));
      reader.readAsDataURL(image);
    });
    return {
      provider: "none",
      mode: options.mode,
      imageDataUrl,
      note:
        options.mode === "2d-texture"
          ? "Textured panel. The image is flat — no geometry was reconstructed."
          : "Depth approximation from brightness. An artistic relief, not a reconstruction: a single image cannot show hidden geometry.",
    };
  },
};

/** Documented slots for external services. Each entry names the env vars
 *  the adapter would read; the implementation is intentionally left to a
 *  future step because no provider is configured for this account yet.
 *  Add a provider by implementing Image3DProvider and registering it in
 *  `image3DProviders`. */
export const EXTERNAL_PROVIDER_SLOTS: {
  id: string;
  label: string;
  envVars: string[];
  docs: string;
  note: string;
  /** For providers that need no API key, the human setup steps instead. */
  setup?: string;
}[] = [
  {
    id: "tripo3d",
    label: "Tripo3D (Tripo AI)",
    envVars: ["IMAGE3D_PROVIDER=tripo3d", "TRIPO_API_KEY"],
    docs: "https://platform.tripo3d.ai/",
    note: "Single-image to 3D model API. Needs an account and API key; usage is billed per generation.",
  },
  {
    id: "meshy",
    label: "Meshy AI",
    envVars: ["IMAGE3D_PROVIDER=meshy", "MESHY_API_KEY"],
    docs: "https://www.meshy.ai/api",
    note: "Image-to-3D API. Needs an account and API key; usage is billed per generation.",
  },
  {
    id: "luma",
    label: "Luma Genie",
    envVars: ["IMAGE3D_PROVIDER=luma", "LUMA_API_KEY"],
    docs: "https://lumalabs.ai/generations",
    note: "Image-to-3D via the Luma API. Needs an account and API key.",
  },
  {
    id: "realitycapture",
    label: "RealityCapture / RealityScan (Epic Games)",
    envVars: [],
    docs: "https://www.realityscan.com",
    note: "Desktop photogrammetry: build a true 3D model from a set of overlapping photos. Processing happens on your own machine — there is no cloud API and no API key to paste into Lakisa. Models built this way are imported back here as .glb. A step-by-step workflow guide is in the Image-to-3D tab.",
    setup:
      "Setup required — not connected. 1) Sign in with an Epic Games account and install RealityScan (the current name for RealityCapture since version 2.0, June 2025) from the Epic Games Launcher onto a Windows PC — there is a headless Linux build for command-line processing, but no macOS version. 2) It is free for individuals and companies under $1M annual gross revenue; above that it is a paid seat licence (check realityscan.com/license for the current threshold and price). 3) Workflow: export your photos from Lakisa, align and reconstruct them in RealityScan (desktop app or its CLI), export the model as .glb, then import that .glb here. No credential is ever pasted into Lakisa — the licence lives in your Epic account and the software on your machine.",
  },
];

export const image3DProviders: Image3DProvider[] = [localApproximationProvider];

export function getImage3DProvider(id: string): Image3DProvider | undefined {
  return image3DProviders.find((provider) => provider.id === id);
}

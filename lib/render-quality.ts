// Render quality for the SANAA 3D gallery (photorealism pass, Nov 2026).
//
// The renderer is Three.js in the browser — Unreal Engine does not run in
// a browser, so "vraie réalité" here means pushing the existing WebGL
// renderer: real-time shadows, PBR surfaces, a generated environment map
// and ACES tone mapping. Nothing here fetches an external HDR: the
// environment is generated locally from three's RoomEnvironment.

export type RenderQuality = "high" | "medium" | "low";

export const RENDER_QUALITY_STORAGE_KEY = "sanaa-render-quality";

export interface RenderQualityConfig {
  // Per-artwork spotlights cast shadows.
  shadows: boolean;
  spotShadowMapSize: number;
  // The single directional (sun-like) fill light casts shadows.
  directionalShadows: boolean;
  directionalShadowMapSize: number;
  // Ceiling track-light elements cast shadows (three shadow maps each —
  // High only, they are the most expensive lights in the scene).
  trackLightShadows: boolean;
  // Locally generated environment map (RoomEnvironment + PMREM).
  env: boolean;
  envIntensity: number;
  // ACESFilmic exposure.
  exposure: number;
  dpr: [number, number];
  // Cheap radial-gradient contact decals under freestanding elements.
  contactDecals: boolean;
}

export const RENDER_QUALITY_CONFIG: Record<RenderQuality, RenderQualityConfig> = {
  high: {
    shadows: true,
    spotShadowMapSize: 1024,
    directionalShadows: true,
    directionalShadowMapSize: 2048,
    trackLightShadows: true,
    env: true,
    envIntensity: 0.5,
    exposure: 1.12,
    dpr: [1, 1.6],
    contactDecals: true,
  },
  medium: {
    shadows: true,
    spotShadowMapSize: 512,
    directionalShadows: false,
    directionalShadowMapSize: 1024,
    trackLightShadows: false,
    env: true,
    envIntensity: 0.45,
    exposure: 1.1,
    dpr: [1, 1.5],
    contactDecals: true,
  },
  low: {
    shadows: false,
    spotShadowMapSize: 0,
    directionalShadows: false,
    directionalShadowMapSize: 0,
    trackLightShadows: false,
    env: false,
    envIntensity: 0,
    exposure: 1.0,
    dpr: [1, 1],
    contactDecals: false,
  },
};

export const RENDER_QUALITY_LABELS: Record<RenderQuality, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const RENDER_QUALITIES: RenderQuality[] = ["high", "medium", "low"];

export function isRenderQuality(value: unknown): value is RenderQuality {
  return value === "high" || value === "medium" || value === "low";
}

/** Default quality: touch / coarse-pointer devices start on Medium —
// a phone GPU pays for every 1024 px shadow map. Desktops start on High. */
export function detectDefaultQuality(): RenderQuality {
  if (typeof window === "undefined") return "high";
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return "medium";
    if (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: none)").matches) return "medium";
  } catch {
    // matchMedia unavailable — fall through to High.
  }
  return "high";
}

export function loadRenderQuality(): RenderQuality {
  if (typeof window === "undefined") return "high";
  try {
    const stored = window.localStorage.getItem(RENDER_QUALITY_STORAGE_KEY);
    if (isRenderQuality(stored)) return stored;
  } catch {
    // Storage unavailable (private mode, blocked) — fall through.
  }
  return detectDefaultQuality();
}

// --- Automatic recommendation for the entry screen ----------------------
// A device-aware recommendation, shown as "Recommended" next to the
// quality choice before the visitor enters. It weighs the same signals
// a visitor's hardware actually reports: a coarse pointer (touch) or
// little memory drops the tier, a slow connection drops it further.
// The visitor can always override it — this only picks the default.
export function recommendQuality(): RenderQuality {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "high";
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string; saveData?: boolean };
    };
    const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
    const slowConnection =
      nav.connection?.saveData === true ||
      (typeof nav.connection?.effectiveType === "string" &&
        ["slow-2g", "2g", "3g"].includes(nav.connection.effectiveType));
    if (slowConnection || (coarse && lowMemory)) return "low";
    if (coarse || lowMemory) return "medium";
  } catch {
    // Any signal unreadable — fall through to High.
  }
  return "high";
}

export function saveRenderQuality(quality: RenderQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Storage unavailable — the setting simply does not persist.
  }
}

// --- Physically-based surface values -------------------------------------
// The procedural canvas textures stay the colour maps; these values only
// tune how each finish reacts to light. Floors read as polished
// (concrete/marble) or satin (wood/stone); walls stay matte plaster
// except marble, which keeps a soft sheen.

export interface SurfacePBR {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
}

export function surfacePBR(style: string | undefined, site: "floor" | "wall" | "ceiling"): SurfacePBR {
  switch (style) {
    case "marble":
      return site === "floor"
        ? { roughness: 0.16, metalness: 0, envMapIntensity: 1.25 }
        : { roughness: 0.32, metalness: 0, envMapIntensity: 0.6 };
    case "concrete":
      return site === "floor"
        ? { roughness: 0.38, metalness: 0, envMapIntensity: 0.7 }
        : { roughness: 0.88, metalness: 0, envMapIntensity: 0.2 };
    case "wood":
      return site === "floor"
        ? { roughness: 0.5, metalness: 0, envMapIntensity: 0.45 }
        : { roughness: 0.68, metalness: 0, envMapIntensity: 0.25 };
    case "parquet":
      // Real light parquet photo (Poly Haven "Wood Floor", CC0): a satin
      // finish, a touch more sheen than the procedural wood tile.
      return site === "floor"
        ? { roughness: 0.42, metalness: 0, envMapIntensity: 0.55 }
        : { roughness: 0.68, metalness: 0, envMapIntensity: 0.25 };
    case "brick":
      return { roughness: 0.92, metalness: 0, envMapIntensity: 0.08 };
    case "stone":
      return site === "floor"
        ? { roughness: 0.62, metalness: 0, envMapIntensity: 0.3 }
        : { roughness: 0.85, metalness: 0, envMapIntensity: 0.15 };
    case "stone-plaster":
    case "stone-concrete":
      // The Stone Gallery surfaces: the reference room's dead-matte
      // stone plaster (walls, roughness 1) and mottled concrete
      // (floor, roughness 0.95) — no polish, no sheen.
      return { roughness: 0.95, metalness: 0, envMapIntensity: 0.1 };
    default:
      // Plaster (and any unknown finish): dead matte, almost no reflection.
      return { roughness: 0.95, metalness: 0, envMapIntensity: 0.12 };
  }
}

// Shared WebXR helpers — used by the Digital Twin tool AND the public
// exhibition visit, so the two never drift apart (one detection, one
// session start, one error vocabulary, one set of movement numbers).
//
// What lives here is deliberately framework-free and DOM-light so it
// can be exercised without a headset (see
// scripts/test-exhibitions-all-galleries.mjs, section (f)): every
// function takes its XR entry point as an optional argument, and falls
// back to `navigator.xr` only when the caller passes none.
//
// What lives here on purpose:
//   - detectXrSupport: navigator.xr + isSessionSupported('immersive-vr'
//     / 'immersive-ar'), with the honest four states the Digital Twin
//     already showed ("unknown" while checking, "supported",
//     "unsupported", "error").
//   - requestVrSession: immersive-vr with the local-floor /
//     bounded-floor options the Twin uses, on the R3F renderer's
//     gl.xr. The renderer is typed structurally so this file does not
//     depend on three.
//   - describeVrError: maps a request failure to one small key the UI
//     translates (never a raw browser message shown to a visitor).
//   - VR_WALK_SPEED_M_S / VR_TELEPORT_M / VR_DEAD_ZONE: the movement
//     numbers the Twin's VR rig used (thumbstick walk, 2 m teleport on
//     the primary button, stick dead zone), now shared.
//
// What does NOT live here: the in-Canvas rig itself — that is
// components/vr-rig.tsx (it needs useFrame and the R3F camera).

export type XrSupport = "unknown" | "supported" | "unsupported" | "error";

export type XrSupportResult = {
  vr: XrSupport;
  ar: XrSupport;
};

/** Minimal shape of the WebXR entry point we need (navigator.xr). */
export type XrSystemLike = {
  isSessionSupported?: (mode: XRSessionMode) => Promise<boolean>;
  requestSession?: (mode: XRSessionMode, options?: XRSessionInit) => Promise<XRSession>;
} | null | undefined;

/** Minimal shape of the R3F renderer's XR manager we need (gl.xr). */
export type XrRendererLike = {
  xr: {
    enabled: boolean;
    setSession: (session: XRSession) => Promise<void>;
  };
};

// Movement numbers, shared by the Twin rig and the public-visit rig:
// thumbstick walk at 1.6 m/s, primary-button teleport 2 m ahead,
// stick dead zone 0.08 (the Twin's values, kept).
export const VR_WALK_SPEED_M_S = 1.6;
export const VR_TELEPORT_M = 2;
export const VR_DEAD_ZONE = 0.08;
/** Eye height the Twin's rig held the camera at (kept as the
    reference eye height for a standing visitor). */
export const VR_EYE_HEIGHT_M = 1.6;

/** Centre height of a hung artwork in AR ("Voir sur mon mur"):
    1.50 m from the floor, the gallery hanging height. */
export const AR_EYE_HEIGHT_M = 1.5;
/** Fallback placement distance when no wall is found: the artwork
    hangs 1.50 m in front of the visitor, at AR_EYE_HEIGHT_M. */
export const AR_FIXED_DISTANCE_M = 1.5;
/** AR frame: the Twin's "black" frame language, kept simple — a
    4 cm border around the image, 4 cm deep. */
export const AR_FRAME_BORDER_M = 0.04;
export const AR_FRAME_DEPTH_M = 0.04;
export const AR_FRAME_COLOR = "#1c1c1c";
/** How long to wait for a vertical (wall) hit before offering the
    fixed-distance fallback (ms). */
export const AR_NO_WALL_TIMEOUT_MS = 10000;
/** A hit-test pose is treated as a wall when its plane normal is
    close to horizontal: |normal.y| below this threshold. Plane
    hit-test poses carry the plane normal on their local +Z axis, so
    a floor (normal straight up, |y| ≈ 1) is excluded and a wall
    (normal horizontal, |y| ≈ 0) is kept. */
export const AR_VERTICAL_NORMAL_MAX_Y = 0.5;

/** Session options for a phone AR visit: hit-test is required
    (no hit-test, no wall to hang on), local-floor and dom-overlay
    are optional — the overlay carries the in-session buttons
    (confirm / reposition / exit) on top of the camera feed. */
export const AR_SESSION_OPTIONS: XRSessionInit = {
  requiredFeatures: ["hit-test"],
  optionalFeatures: ["local-floor", "dom-overlay"],
};

/** Parse "120×89 cm" / "120 x 89" into metres { w, h }. Returns
    null when unparseable. Dimensions are stored in cm unless they
    are already small (<= 10 means metres). Shared by the Digital
    Twin and the public "Voir sur mon mur" AR view, so the two never
    disagree about a work's real size. */
export function parseArtworkDimensions(dimensions: string): { w: number; h: number } | null {
  const match = dimensions.match(/([\d.,]+)\s*[×x]\s*([\d.,]+)/);
  if (!match) return null;
  const w = Number.parseFloat(match[1].replace(",", "."));
  const h = Number.parseFloat(match[2].replace(",", "."));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const scale = w > 10 || h > 10 ? 0.01 : 1;
  return { w: w * scale, h: h * scale };
}

/** Fallback real size when an artwork carries no parseable
    dimensions: 90 × 120 cm, the gallery's common large format. */
export const AR_DEFAULT_ARTWORK_SIZE_M = { w: 0.9, h: 1.2 };

/**
 * Is this hit-test pose on a vertical surface (a wall)? The pose's
 * local +Z axis is the plane normal for plane hit-tests, so rotate
 * (0, 0, 1) by the pose quaternion and look at its Y component:
 * near 0 for a wall, near ±1 for a floor or ceiling. Pure math, no
 * three dependency, so the rule is testable without a renderer.
 */
export function hitPoseIsVertical(quaternion: { x: number; y: number; z: number; w: number }): boolean {
  const { x, y, z, w } = quaternion;
  // Third row of the rotation matrix applied to (0, 0, 1):
  // normal.y = 2 * (y*z + w*x).
  const normalY = 2 * (y * z + w * x);
  return Math.abs(normalY) < AR_VERTICAL_NORMAL_MAX_Y;
}

/** Session options for a standing / room-scale visit: the floor is
    the reference (local-floor), with bounded-floor when the headset
    offers a play-area boundary. */
export const VR_SESSION_OPTIONS: XRSessionInit = {
  optionalFeatures: ["local-floor", "bounded-floor"],
};

function resolveXr(passed?: XrSystemLike): XrSystemLike {
  if (passed !== undefined) return passed;
  if (typeof navigator === "undefined") return null;
  return "xr" in navigator ? navigator.xr : null;
}

/**
 * Check WebXR support on this device/browser. Never throws: any
 * failure to ask (no navigator.xr, isSessionSupported rejecting)
 * is reported as "unsupported" / "error" instead of breaking the
 * page that asked.
 */
export async function detectXrSupport(passedXr?: XrSystemLike): Promise<XrSupportResult> {
  const xr = resolveXr(passedXr);
  if (!xr || typeof xr.isSessionSupported !== "function") {
    return { vr: "unsupported", ar: "unsupported" };
  }
  try {
    const [vr, ar] = await Promise.all([
      xr.isSessionSupported("immersive-vr").catch(() => false),
      xr.isSessionSupported("immersive-ar").catch(() => false),
    ]);
    return { vr: vr ? "supported" : "unsupported", ar: ar ? "supported" : "unsupported" };
  } catch {
    return { vr: "error", ar: "error" };
  }
}

/**
 * Start an immersive-vr session on the given renderer and attach it
 * (gl.xr.setSession). Throws the underlying error when the session
 * cannot start (denied, no headset, disconnected) — the caller maps
 * it with describeVrError and shows an inline message, never a
 * broken page. The caller owns the session afterwards (including
 * listening for "end").
 */
export async function requestVrSession(
  renderer: XrRendererLike,
  passedXr?: XrSystemLike,
): Promise<XRSession> {
  const xr = resolveXr(passedXr);
  if (!xr || typeof xr.requestSession !== "function") {
    throw new Error("WebXR is not available in this browser.");
  }
  const session = await xr.requestSession("immersive-vr", VR_SESSION_OPTIONS);
  renderer.xr.enabled = true;
  await renderer.xr.setSession(session);
  return session;
}

/**
 * Start an immersive-ar session for "Voir sur mon mur". The caller
 * passes the dom-overlay root (the element carrying the in-session
 * buttons) when it has one; without it the session still starts,
 * just without overlay buttons (the phone's system UI remains the
 * exit). Throws when the session cannot start — the caller maps it
 * with describeArError. The caller owns the session afterwards
 * (hit-test source, animation loop, listening for "end").
 */
export async function requestArSession(
  domOverlayRoot?: Element | null,
  passedXr?: XrSystemLike,
): Promise<XRSession> {
  const xr = resolveXr(passedXr);
  if (!xr || typeof xr.requestSession !== "function") {
    throw new Error("WebXR is not available in this browser.");
  }
  const options: XRSessionInit = { ...AR_SESSION_OPTIONS };
  if (domOverlayRoot) options.domOverlay = { root: domOverlayRoot };
  return xr.requestSession("immersive-ar", options);
}

/** Small, translatable key for a VR session failure. */
export type VrErrorKey = "denied" | "notSupported" | "failed";

export function describeVrError(error: unknown): VrErrorKey {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
    if (error.name === "NotSupportedError") return "notSupported";
    if (/not available|not supported/i.test(error.message)) return "notSupported";
  }
  return "failed";
}

/** Small, translatable key for an AR session failure. "noHitTest"
    is the AR-specific case: the session started (or could start)
    but this device offers no hit-test, so no wall can be found. */
export type ArErrorKey = "denied" | "notSupported" | "noHitTest" | "failed";

export function describeArError(error: unknown): ArErrorKey {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
    if (error.name === "NotSupportedError") return "notSupported";
    if (/hit-test|hit test/i.test(error.message)) return "noHitTest";
    if (/not available|not supported/i.test(error.message)) return "notSupported";
  }
  return "failed";
}

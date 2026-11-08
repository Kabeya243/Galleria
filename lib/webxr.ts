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

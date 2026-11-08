"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Check, MapPin, Move, Scan, X } from "lucide-react";
import {
  AR_DEFAULT_ARTWORK_SIZE_M,
  AR_EYE_HEIGHT_M,
  AR_FIXED_DISTANCE_M,
  AR_FRAME_BORDER_M,
  AR_FRAME_COLOR,
  AR_FRAME_DEPTH_M,
  AR_NO_WALL_TIMEOUT_MS,
  describeArError,
  detectXrSupport,
  hitPoseIsVertical,
  parseArtworkDimensions,
  requestArSession,
  type ArErrorKey,
  type XrSupport,
} from "@/lib/webxr";
import { useT } from "@/lib/i18n";

// "Voir sur mon mur" — public AR view of one artwork on the visitor's
// own wall, from the artwork detail panel of a public exhibition.
//
// How it works (phone, WebXR immersive-ar):
//   1. The visitor taps "Voir sur mon mur". The session is requested
//      with hit-test (required) + dom-overlay (the in-session buttons).
//   2. A plane hit-test source looks for real surfaces. A hit whose
//      plane normal is horizontal is a WALL (see hitPoseIsVertical in
//      lib/webxr.ts); a horizontal plane is a floor and is reported as
//      such, never hung on. The gold ring (reticle) marks the wall hit.
//   3. Tapping the screen anchors the framed artwork to the wall at
//      its REAL size (dimensions parsed from the artwork record, cm
//      to metres) with its centre at 1.50 m from the floor — the
//      gallery hanging height. Tapping again re-anchors (reposition);
//      "Valider" locks the placement; "Repositionner" unlocks it.
//   4. When no wall is found (some phones only detect horizontal
//      planes, or the room has none in view), after 10 s the visitor
//      is offered a fixed-distance placement: 1.50 m in front of them,
//      at eye height, facing them — a reasonable stand-in, labelled
//      as such. If the device offers no hit-test at all, the session
//      cannot start and the inline message says so.
//   5. Exit is the in-overlay button or the phone's system button;
//      both go through the session "end" listener, which disposes the
//      renderer and returns the visitor to the normal visit.
//
// What it deliberately does NOT do: iOS. Safari does not support
// WebXR, so on iPhone the button is disabled with an honest inline
// explanation (see the "ar" strings in lib/i18n.ts). A Quick Look
// (USDZ) fallback would need a server-side USDZ pipeline that does
// not exist in this repo — that is a decision for Kabeya, not a
// silent half-build here. The frame is the Twin's simple dark frame
// (4 cm border, 4 cm deep), not the gallery's procedural Frame Studio
// finishes — those need the full frame-spec resolver and would double
// the component for no gain in AR, where scale is the point.
//
// The Digital Twin's AR preview (components/digital-twin.tsx) is the
// creator-side equivalent; this component is the visitor-side one.
// Both share lib/webxr.ts (detection, session, error vocabulary,
// dimension parsing, eye height) and must not drift apart.

export type ArWallArtwork = {
  title: string;
  dimensions: string;
  imageUrl: string;
  color?: string | null;
};

type ArStatusKey =
  | ArErrorKey
  | "requesting"
  | "viewLoading"
  | "pointAtWall"
  | "wallFound"
  | "floorFound"
  | "noWallYet"
  | "placed"
  | "fixedPlaced"
  | "ended";

export default function ArWallView({ artwork }: { artwork: ArWallArtwork }) {
  const t = useT();
  const [support, setSupport] = useState<XrSupport>("unknown");
  const [inSession, setInSession] = useState(false);
  const [statusKey, setStatusKey] = useState<ArStatusKey | null>(null);
  const [placed, setPlaced] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [canPlaceFixed, setCanPlaceFixed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const artGroupRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  // Latest poses, kept in refs so the animation loop never re-renders.
  const latestVerticalRef = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);
  const latestAnyHitRef = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);
  const latestViewerRef = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);
  const floorSpaceRef = useRef(false);
  const planeDetectionRef = useRef(true);
  const confirmedRef = useRef(false);
  const placedRef = useRef(false);
  const statusKeyRef = useRef<ArStatusKey | null>(null);
  const fixedOfferedRef = useRef(false);
  const sessionStartRef = useRef(0);

  const size = parseArtworkDimensions(artwork.dimensions) ?? AR_DEFAULT_ARTWORK_SIZE_M;

  function setStatus(key: ArStatusKey | null) {
    if (statusKeyRef.current === key) return;
    statusKeyRef.current = key;
    setStatusKey(key);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const support = await detectXrSupport();
        if (!cancelled) setSupport(support.ar);
      } catch {
        if (!cancelled) setSupport("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the page (or the panel closing) mid-session ends the
  // session cleanly instead of leaving the camera running.
  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session) {
        session.end().catch(() => undefined);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  function cleanupSession() {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    }
    rendererRef.current = null;
    sessionRef.current = null;
    artGroupRef.current = null;
    reticleRef.current = null;
    latestVerticalRef.current = null;
    latestAnyHitRef.current = null;
    latestViewerRef.current = null;
    fixedOfferedRef.current = false;
    placedRef.current = false;
    confirmedRef.current = false;
    setPlaced(false);
    setConfirmed(false);
    setCanPlaceFixed(false);
    setInSession(false);
  }

  async function startAR() {
    if (support !== "supported") {
      setStatus("notSupported");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus("viewLoading");
      return;
    }
    setStatus("requesting");
    try {
      // dom-overlay root is document.body, like the Twin: the overlay
      // buttons below are part of the page, so the phone composites
      // them over the camera feed.
      const session = await requestArSession(document.body);
      sessionRef.current = session;
      sessionStartRef.current = Date.now();

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.xr.enabled = true;
      rendererRef.current = renderer;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.2));

      // Reticle: the Twin's gold ring, shown where the hit-test finds
      // a wall (hidden once the placement is confirmed).
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xa67c37, side: THREE.DoubleSide }),
      );
      reticle.visible = false;
      scene.add(reticle);
      reticleRef.current = reticle;

      // The artwork at its real size, in the simple dark frame.
      // Frame: a slab behind the image, 4 cm border, 4 cm deep; the
      // image plane sits 5 mm in front of the frame's front face.
      const artGroup = new THREE.Group();
      artGroup.visible = false;
      const artW = size.w;
      const artH = size.h;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(artW + AR_FRAME_BORDER_M * 2, artH + AR_FRAME_BORDER_M * 2, AR_FRAME_DEPTH_M),
        new THREE.MeshStandardMaterial({ color: AR_FRAME_COLOR }),
      );
      frame.position.z = -AR_FRAME_DEPTH_M / 2;
      artGroup.add(frame);
      const artMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(artW, artH),
        new THREE.MeshStandardMaterial({ color: artwork.color || "#b8a184" }),
      );
      artMesh.position.z = 0.005;
      artGroup.add(artMesh);
      if (artwork.imageUrl) {
        new THREE.TextureLoader().load(artwork.imageUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          (artMesh.material as THREE.MeshStandardMaterial).map = texture;
          (artMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        });
      }
      scene.add(artGroup);
      artGroupRef.current = artGroup;

      // Reference space: local-floor when the device offers it, so
      // "1.50 m from the floor" is exact. Otherwise "local", where
      // y = 0 is the head height at session start — eye height by
      // definition, so the artwork is hung at the hit's own height
      // instead of an absolute 1.50 m.
      let refSpace: XRReferenceSpace;
      try {
        refSpace = await session.requestReferenceSpace("local-floor");
        floorSpaceRef.current = true;
      } catch {
        refSpace = await session.requestReferenceSpace("local");
        floorSpaceRef.current = false;
      }
      renderer.xr.setReferenceSpaceType(floorSpaceRef.current ? "local-floor" : "local");
      const viewerSpace = await session.requestReferenceSpace("viewer");

      // Hit-test: prefer plane entities (poses carry the plane normal,
      // so walls can be told apart from floors). Some devices reject
      // entityTypes — fall back to the viewer ray, and treat hits as
      // generic surfaces (upright, facing the visitor) instead.
      let hitSource: XRHitTestSource | null = null;
      planeDetectionRef.current = true;
      if (typeof session.requestHitTestSource === "function") {
        try {
          hitSource = (await session.requestHitTestSource({ space: viewerSpace, entityTypes: ["plane"] })) ?? null;
        } catch {
          hitSource = null;
        }
        if (!hitSource) {
          try {
            hitSource = (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
            planeDetectionRef.current = false;
          } catch {
            hitSource = null;
          }
        }
      }
      if (!hitSource) throw new Error("This device's AR session does not offer hit-test.");

      // Height of the artwork centre: 1.50 m above the floor when the
      // floor is known, otherwise the height of the hit itself (eye
      // height in "local" space).
      function centreHeight(hitY: number): number {
        return floorSpaceRef.current ? AR_EYE_HEIGHT_M : hitY;
      }
      // Upright orientation facing the visitor, from the viewer pose:
      // used for the fixed-distance placement and for ray hit-test
      // hits (whose pose orientation follows the ray, not the wall).
      function facingViewerQuaternion(viewerQuat: THREE.Quaternion): THREE.Quaternion {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewerQuat);
        const yaw = Math.atan2(-forward.x, -forward.z);
        return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      }
      function anchorAt(position: THREE.Vector3, quaternion: THREE.Quaternion) {
        artGroup.position.copy(position);
        artGroup.quaternion.copy(quaternion);
        artGroup.visible = true;
      }

      const onSelect = () => {
        if (confirmedRef.current) return;
        const vertical = latestVerticalRef.current;
        const any = latestAnyHitRef.current;
        if (planeDetectionRef.current) {
          // Only a wall anchors on tap — a floor hit is reported,
          // never hung on.
          if (!vertical) return;
          const position = vertical.position.clone();
          position.y = centreHeight(vertical.position.y);
          anchorAt(position, vertical.quaternion);
        } else {
          if (!any) return;
          const viewer = latestViewerRef.current;
          const position = any.position.clone();
          position.y = centreHeight(any.position.y);
          anchorAt(position, viewer ? facingViewerQuaternion(viewer.quaternion) : any.quaternion);
        }
        placedRef.current = true;
        setPlaced(true);
        setStatus("placed");
      };
      session.addEventListener("select", onSelect);
      session.addEventListener("end", () => {
        cleanupSession();
        setStatus("ended");
      });

      await renderer.xr.setSession(session);
      renderer.setAnimationLoop((time, frame) => {
        if (!frame) return;
        const viewerPose = frame.getViewerPose(refSpace);
        if (viewerPose) {
          latestViewerRef.current = {
            position: new THREE.Vector3(
              viewerPose.transform.position.x,
              viewerPose.transform.position.y,
              viewerPose.transform.position.z,
            ),
            quaternion: new THREE.Quaternion(
              viewerPose.transform.orientation.x,
              viewerPose.transform.orientation.y,
              viewerPose.transform.orientation.z,
              viewerPose.transform.orientation.w,
            ),
          };
        }
        const hits = frame.getHitTestResults(hitSource);
        latestAnyHitRef.current = null;
        latestVerticalRef.current = null;
        if (hits.length > 0) {
          const pose = hits[0].getPose(refSpace);
          if (pose) {
            const position = new THREE.Vector3(
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z,
            );
            const quaternion = new THREE.Quaternion(
              pose.transform.orientation.x,
              pose.transform.orientation.y,
              pose.transform.orientation.z,
              pose.transform.orientation.w,
            );
            const hit = { position, quaternion };
            latestAnyHitRef.current = hit;
            const isWall = planeDetectionRef.current
              ? hitPoseIsVertical(pose.transform.orientation)
              : true;
            if (isWall) latestVerticalRef.current = hit;
            if (!confirmedRef.current) {
              reticle.visible = true;
              reticle.position.copy(position);
              reticle.quaternion.copy(
                planeDetectionRef.current
                  ? quaternion
                  : latestViewerRef.current
                    ? facingViewerQuaternion(latestViewerRef.current.quaternion)
                    : quaternion,
              );
            }
          }
        }
        if (!confirmedRef.current) {
          if (latestVerticalRef.current) {
            reticle.visible = true;
            setStatus("wallFound");
          } else if (latestAnyHitRef.current) {
            reticle.visible = false;
            setStatus("floorFound");
          } else {
            reticle.visible = false;
            if (Date.now() - sessionStartRef.current > AR_NO_WALL_TIMEOUT_MS) {
              setStatus("noWallYet");
              if (!fixedOfferedRef.current) {
                fixedOfferedRef.current = true;
                setCanPlaceFixed(true);
              }
            } else {
              setStatus("pointAtWall");
            }
          }
        } else {
          reticle.visible = false;
        }
        renderer.render(scene, camera);
      });
      setInSession(true);
      setStatus("pointAtWall");
    } catch (error) {
      cleanupSession();
      setStatus(describeArError(error));
    }
  }

  async function endAR() {
    const session = sessionRef.current;
    if (!session) {
      cleanupSession();
      setStatus("ended");
      return;
    }
    try {
      await session.end();
    } catch {
      // The "end" listener already cleans up; a failure here just
      // forces the same outcome.
      cleanupSession();
      setStatus("ended");
    }
  }

  function placeAtFixedDistance() {
    const viewer = latestViewerRef.current;
    const artGroup = artGroupRef.current;
    if (!viewer || !artGroup) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion);
    const position = viewer.position.clone().addScaledVector(forward, AR_FIXED_DISTANCE_M);
    position.y = floorSpaceRef.current ? AR_EYE_HEIGHT_M : viewer.position.y;
    const yaw = Math.atan2(-forward.x, -forward.z);
    artGroup.position.copy(position);
    artGroup.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    artGroup.visible = true;
    placedRef.current = true;
    setPlaced(true);
    setConfirmed(false);
    confirmedRef.current = false;
    setStatus("fixedPlaced");
  }

  function confirmPlacement() {
    confirmedRef.current = true;
    setConfirmed(true);
    if (reticleRef.current) reticleRef.current.visible = false;
    setStatus("placed");
  }

  function reposition() {
    confirmedRef.current = false;
    setConfirmed(false);
    setStatus("pointAtWall");
  }

  const realSizeLabel = `${artwork.dimensions} — ${t("ar", "realSizeNote")}`;

  return (
    <div className="artwork-detail-ar">
      {support === "supported" && !inSession && (
        <button type="button" className="artwork-detail-ar-button" onClick={() => void startAR()}>
          <Scan size={14} /> {t("ar", "viewOnMyWall")}
        </button>
      )}
      {support === "unknown" && (
        <button type="button" className="artwork-detail-ar-button" disabled>
          <Scan size={14} /> {t("ar", "checking")}
        </button>
      )}
      {(support === "unsupported" || support === "error") && (
        <>
          <button type="button" className="artwork-detail-ar-button" disabled>
            <Scan size={14} /> {t("ar", "viewOnMyWall")}
          </button>
          <p className="artwork-detail-ar-note" role="status">
            <strong>{t("ar", "notSupported")}</strong> {t("ar", "notSupportedHint")}
          </p>
        </>
      )}
      {support === "supported" && !inSession && (
        <p className="artwork-detail-ar-note">{realSizeLabel}</p>
      )}
      {statusKey && !inSession && support === "supported" && (
        <p className="artwork-detail-ar-note" role="status">
          {t("ar", statusKey)}
        </p>
      )}

      {/* The AR session renders into this canvas; the camera feed shows
          through it (alpha). Hidden until a session is live. */}
      <canvas
        ref={canvasRef}
        className="ar-wall-canvas"
        style={{ display: inSession ? "block" : "none" }}
        aria-label={t("ar", "viewOnMyWall")}
      />

      {/* In-session overlay (dom-overlay): status + confirm / reposition
          / fixed-distance / exit. pointer-events only on the buttons, so
          taps on the camera feed still reach the XR select handler. */}
      <div
        className="ar-wall-overlay"
        style={{ display: inSession ? "flex" : "none" }}
        aria-hidden={!inSession}
      >
        {statusKey && (
          <p className="ar-wall-status" role="status">
            {t("ar", statusKey)}
          </p>
        )}
        <div className="ar-wall-actions">
          {canPlaceFixed && !confirmed && (
            <button type="button" className="ar-wall-button" onClick={placeAtFixedDistance}>
              <MapPin size={14} /> {t("ar", "placeAtFixedDistance")}
            </button>
          )}
          {placed && !confirmed && (
            <button type="button" className="ar-wall-button ar-wall-button-primary" onClick={confirmPlacement}>
              <Check size={14} /> {t("ar", "confirmPlacement")}
            </button>
          )}
          {confirmed && (
            <button type="button" className="ar-wall-button" onClick={reposition}>
              <Move size={14} /> {t("ar", "reposition")}
            </button>
          )}
          <button type="button" className="ar-wall-button" onClick={() => void endAR()}>
            <X size={14} /> {t("ar", "exitAR")}
          </button>
        </div>
      </div>
    </div>
  );
}

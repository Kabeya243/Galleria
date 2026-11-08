// Placing a newly added artwork where the visitor can actually see it.
//
// The bug this fixes: `placeOnCameraWall` raycast the wall the camera
// looked at and hung the work at the ray's hit point — plus a spread
// offset of up to ±2 m along the wall — with no check that the result
// was still inside the camera's field of view, and with a blind
// fallback to the back wall when the ray hit nothing. Three ways a
// new work landed out of sight:
//
//   1. The spread offset. At a wall 1–2 m away (a freestanding panel
//      or cloison right in front of the camera), ±2 m along the wall
//      is 45–63° off axis — far outside the ~66° vertical / ~90°
//      horizontal field of view. The work hung on the wall the
//      camera faced and was still invisible.
//   2. The blind fallback. When the ray hit no wall — steep pitch
//      (High / Plan views look down), a ray through a gap, or no
//      camera state yet — the work went to the back wall, which can
//      sit BEHIND the camera (walk in from the entrance facing the
//      front wall and the back wall is at your back) or 20 m away.
//   3. Distance. A ray down a 40 m room hangs the work 20+ m away:
//      an 0.8 m work subtends ~2°, a speck. (Placement cannot fix
//      distance — the wall is where it is — so this module reports
//      the distance and lets the caller decide; the turn below at
//      least centres it.)
//
// What this module does instead, in room-local coordinates (the same
// frame the wall faces live in):
//   - Raycast with the camera's HORIZONTAL gaze only (pitch ignored:
//     a work hangs at eye level whatever the pitch, so the pitch
//     only decides whether the visitor can see it at all — the
//     editor levels the pitch back to eye view when it is steep).
//   - Clamp the along-wall placement into a safe view cone
//     (±20° horizontal, ±15° vertical around the gaze) by solving
//     for the along-wall coordinate at the cone's edge, so the
//     spread offset can never push the work off-screen.
//   - When no wall is in view at all, pick the face most in front of
//     the camera (smallest angular deviation, eye-level point
//     nearest the gaze) instead of the back wall, and report the yaw
//     the camera must turn to for the work to be centred
//     (`needsTurn` + `yawToFace`). The editor turns the camera
//     gently toward it (the walk controls already ease a look yaw);
//     the placement itself never moves the camera.
//   - When even the cone clamp cannot bring the work into view (the
//     whole wall sits beside the camera), report the same turn
//     instead of hanging the work off-screen.
//
// The cone is deliberately conservative (20°, not the ~45° half
// field of view): it keeps the whole work — not just its centre —
// inside the frame on a narrow / portrait canvas, and it leaves the
// work near the centre of the view rather than at its edge.
//
// Pure functions, no React / three.js: the exhibition test harness
// (scripts/test-exhibitions-all-galleries.mjs) exercises them for
// every gallery.

import {
  raycastHangWalls,
  sunlightPlaceOnWall,
  type HangWallFace,
} from "@/lib/sunlight-elements";

// Half-angles of the safe view cone around the camera's gaze. The
// walk camera is 66° vertical; 20° horizontal keeps the whole work
// in frame even on a narrow canvas, 15° vertical keeps it near eye
// level (a hung work is at ~1.55 m, the eye at 1.6 m, so the
// vertical angle is ~0° in practice — the check only bites when the
// wall is very close and the height clamp pushes the centre up).
// The cone edge carries a 0.5° tolerance: the clamp solves for
// exactly 20°, and floating-point noise alone lands at 20.0000004°.
export const PLACE_IN_VIEW_HALF_HORIZ_DEG = 20;
export const PLACE_IN_VIEW_HALF_VERT_DEG = 15;
const ANGLE_EPS_DEG = 0.5;

// Eye level for a newly hung work (the Compose row height and the
// old placeOnCameraWall fallback agreed on 1.55 m).
export const PLACE_IN_VIEW_EYE_Y = 1.55;

export type ViewCamera = {
  x: number;
  y: number;
  z: number;
  // Yaw in the scene's convention: forward =
  // (−sin yaw, −cos yaw) in (x, z), YXZ order.
  yaw: number;
  pitch: number;
};

export type PlaceInViewResult = {
  position: [number, number, number];
  rotation: number;
  // The wall face the work hangs on.
  faceId: string;
  // Straight-line distance camera → work centre (m).
  distance: number;
  // Angular offset of the work centre from the gaze (°).
  horizAngleDeg: number;
  vertAngleDeg: number;
  // True when the work centre sits inside the safe cone.
  inView: boolean;
  // True when no placement on the faced wall could bring the work
  // into the cone (or no wall was in view): the camera must turn.
  // The turn target is yawToFace; null when no turn is needed.
  needsTurn: boolean;
  yawToFace: number | null;
  // True when the ray hit no wall and the most-forward face was
  // used instead.
  fallback: boolean;
};

const DEG = Math.PI / 180;

function wrapAngle(rad: number): number {
  return Math.atan2(Math.sin(rad), Math.cos(rad));
}

// Yaw that faces a point from a camera position (the scene's yaw
// convention: forward = (−sin yaw, −cos yaw)).
export function yawToFacePoint(
  camera: { x: number; z: number },
  point: { x: number; z: number },
): number {
  return Math.atan2(-(point.x - camera.x), -(point.z - camera.z));
}

function angleOfPoint(
  camera: ViewCamera,
  point: { x: number; y: number; z: number },
): { horizDeg: number; vertDeg: number; distance: number; depth: number } {
  const fx = -Math.sin(camera.yaw);
  const fz = -Math.cos(camera.yaw);
  // Right vector in the (x, z) plane: (−fz, fx) is +x when facing −z.
  const rx = -fz;
  const rz = fx;
  const dx = point.x - camera.x;
  const dz = point.z - camera.z;
  const depth = dx * fx + dz * fz;
  const lateral = dx * rx + dz * rz;
  const horizontalDist = Math.hypot(depth, lateral);
  return {
    horizDeg: Math.atan2(lateral, depth) / DEG,
    vertDeg: Math.atan2(point.y - camera.y, horizontalDist) / DEG,
    distance: Math.hypot(horizontalDist, point.y - camera.y),
    depth,
  };
}

// The along-wall coordinate (metres from the face centre, along the
// face axis) whose point on the face sits exactly at `targetHorizDeg`
// from the camera's gaze — the closed-form solve for the cone clamp.
// Null when moving along this wall cannot change the angle (the wall
// runs parallel to the gaze), so no clamp can help.
function alongAtAngle(
  camera: ViewCamera,
  face: HangWallFace,
  targetHorizDeg: number,
): number | null {
  const fx = -Math.sin(camera.yaw);
  const fz = -Math.cos(camera.yaw);
  const rx = -fz;
  const rz = fx;
  // Point on the face at along s, 0.1 m off it (the hang stand-off):
  // P(s) = centre + axis·s + normal·0.1.
  const bx = face.cx + face.nx * 0.1 - camera.x;
  const bz = face.cz + face.nz * 0.1 - camera.z;
  const depth0 = bx * fx + bz * fz;
  const lat0 = bx * rx + bz * rz;
  const dDepth = face.ax * fx + face.az * fz;
  const dLat = face.ax * rx + face.az * rz;
  // Want lat(s) = tan(target) · depth(s), both affine in s.
  const t = Math.tan(targetHorizDeg * DEG);
  const denom = dLat - t * dDepth;
  if (Math.abs(denom) < 1e-9) return null;
  return (t * depth0 - lat0) / denom;
}

export function placeArtworkInView(
  camera: ViewCamera,
  faces: HangWallFace[],
  width: number,
  height: number,
  alongOffset = 0,
): PlaceInViewResult {
  const halfH = PLACE_IN_VIEW_HALF_HORIZ_DEG;
  const halfV = PLACE_IN_VIEW_HALF_VERT_DEG;
  // Horizontal gaze only (see the module note): the ray is cast at
  // eye height, so a steep pitch can no longer make the ray sail
  // over the wall and trigger the blind back-wall fallback.
  const direction = {
    x: -Math.sin(camera.yaw),
    y: 0,
    z: -Math.cos(camera.yaw),
  };
  const origin = { x: camera.x, y: camera.y, z: camera.z };
  const hit = raycastHangWalls(origin, direction, faces);

  const finish = (
    placed: { position: [number, number, number]; rotation: number },
    face: HangWallFace,
    fallback: boolean,
  ): PlaceInViewResult => {
    const centre = { x: placed.position[0], y: placed.position[1], z: placed.position[2] };
    const angle = angleOfPoint(camera, centre);
    const inView =
      angle.depth > 0 &&
      Math.abs(angle.horizDeg) <= halfH + ANGLE_EPS_DEG &&
      Math.abs(angle.vertDeg) <= halfV + ANGLE_EPS_DEG;
    const needsTurn = !inView;
    return {
      position: placed.position,
      rotation: placed.rotation,
      faceId: face.id,
      distance: angle.distance,
      horizAngleDeg: angle.horizDeg,
      vertAngleDeg: angle.vertDeg,
      inView,
      needsTurn,
      yawToFace: needsTurn ? yawToFacePoint(camera, centre) : null,
      fallback,
    };
  };

  if (hit) {
    const placed = sunlightPlaceOnWall(hit, height, width, alongOffset);
    const centre = { x: placed.position[0], y: placed.position[1], z: placed.position[2] };
    const angle = angleOfPoint(camera, centre);
    if (
      angle.depth > 0 &&
      Math.abs(angle.horizDeg) <= halfH + ANGLE_EPS_DEG &&
      Math.abs(angle.vertDeg) <= halfV + ANGLE_EPS_DEG
    ) {
      return finish(placed, hit.face, false);
    }
    // Off-cone: pull the work back to the cone's edge along the same
    // wall (the along coordinate of the ray hit, plus the requested
    // spread, is the starting point — the clamp only ever moves it
    // toward the gaze, never away).
    const hitAlong =
      (hit.point.x - hit.face.cx) * hit.face.ax + (hit.point.z - hit.face.cz) * hit.face.az;
    const target = Math.sign(angle.horizDeg || 1) * halfH;
    const clampedAlong = alongAtAngle(camera, hit.face, target);
    if (clampedAlong !== null) {
      const halfW = width / 2;
      const extent = Math.max(0, hit.face.halfLen - halfW);
      const along = Math.min(Math.max(clampedAlong, -extent), extent);
      const clamped = sunlightPlaceOnWall(hit, height, width, along - hitAlong);
      const clampedCentre = { x: clamped.position[0], y: clamped.position[1], z: clamped.position[2] };
      const clampedAngle = angleOfPoint(camera, clampedCentre);
      // Accept the clamp when it moves the work toward the cone
      // (a short wall may end before the cone does — then the
      // clamped spot is still the closest one, and the turn below
      // centres it the rest of the way).
      if (Math.abs(clampedAngle.horizDeg) <= Math.abs(angle.horizDeg)) {
        return finish(clamped, hit.face, false);
      }
    }
    // The wall runs parallel to the gaze: no along-wall move can
    // bring the work into view — turn the camera toward it.
    return finish(placed, hit.face, false);
  }

  // No wall in view: the most-forward face, not the back wall. For
  // each face, the eye-level point nearest the gaze (the camera's
  // projection onto the face, clamped to its extent); the face whose
  // point deviates least from the gaze wins, among faces in front of
  // the camera. A closed room always has one; if the camera is
  // somehow outside every face's front, the least-behind face wins
  // and the turn below still centres it.
  let best: { face: HangWallFace; point: { x: number; y: number; z: number }; score: number } | null = null;
  for (const face of faces) {
    const halfW = width / 2;
    const extent = Math.max(0, face.halfLen - halfW);
    const projected = (camera.x - face.cx) * face.ax + (camera.z - face.cz) * face.az;
    const along = Math.min(Math.max(projected, -extent), extent);
    const point = {
      x: face.cx + face.ax * along + face.nx * 0.1,
      y: PLACE_IN_VIEW_EYE_Y,
      z: face.cz + face.az * along + face.nz * 0.1,
    };
    const angle = angleOfPoint(camera, point);
    // A work can only be seen from its face's front side: the camera
    // must stand on the normal side of the plane. A face the camera
    // stands behind scores as behind (180+) even when its point is
    // geometrically ahead of the camera — the wall itself would hide
    // the work. In a real room a front-side face always exists (room
    // walls face inward, freestanding walls carry both faces).
    const frontDist = (camera.x - face.cx) * face.nx + (camera.z - face.cz) * face.nz;
    const score = frontDist > 0 && angle.depth > 0 ? Math.abs(angle.horizDeg) : 180 + Math.abs(angle.horizDeg);
    if (!best || score < best.score) {
      best = { face, point, score };
    }
  }
  if (!best) {
    // No hangable face at all (a room with no walls): nowhere to put
    // the work — return a centred eye-level spot so the caller still
    // has a position, and a turn toward it.
    const point: [number, number, number] = [camera.x, PLACE_IN_VIEW_EYE_Y, camera.z - 2];
    return {
      position: point,
      rotation: camera.yaw,
      faceId: "",
      distance: 2,
      horizAngleDeg: 0,
      vertAngleDeg: 0,
      inView: false,
      needsTurn: true,
      yawToFace: yawToFacePoint(camera, { x: point[0], z: point[2] }),
      fallback: true,
    };
  }
  const placed = sunlightPlaceOnWall(
    { point: best.point, normal: { x: best.face.nx, z: best.face.nz }, face: best.face },
    height,
    width,
    0,
  );
  return finish(placed, best.face, true);
}

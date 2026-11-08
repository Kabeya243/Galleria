"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { VR_DEAD_ZONE, VR_TELEPORT_M, VR_WALK_SPEED_M_S } from "@/lib/webxr";

// Shared VR rig — the Digital Twin tool and the public exhibition
// visit render the SAME movement, from this one file.
//
// Why a dolly (a Group that carries the camera) instead of moving
// the camera directly, as the Twin's first rig did: in three.js the
// headset pose overwrites the camera's own position and rotation on
// every XR frame (WebXRManager.updateCamera decomposes the viewer
// pose back into the app camera), so camera.position writes inside
// useFrame never move the rendered stereo view — the thumbstick and
// the teleport looked wired but did nothing in a real headset. A
// parent group is the documented three.js pattern: the pose is
// applied relative to the dolly, so moving the dolly moves the
// visitor, and the headset still owns the look direction.
//
// Movement (kept from the Twin, same numbers — see lib/webxr.ts):
// right thumbstick walks on the floor plane at 1.6 m/s, the primary
// button teleports 2 m ahead. One fix versus the Twin's first rig:
// the strafe sign was inverted there (right stick pushed the visitor
// left); here right is cross(forward, up), the same right the flat
// walk controls use.

export type VrDollyRef = { current: THREE.Group | null };

/**
 * VrDolly — while `enabled`, the R3F camera rides in a Group placed
 * at the camera's current ground position and yaw, so the visitor
 * enters VR exactly where they were standing and looking. While
 * disabled the camera is back in the scene, untouched.
 * On disable (session end) the camera is restored to its world
 * transform, so the visitor comes back to the normal visit at the
 * spot they reached in VR — the position is conserved. (The look
 * direction is not: the flat walk controls own their own yaw and
 * resume from the pre-VR yaw on the next frame.)
 */
export function VrDolly({ enabled, dollyRef }: { enabled: boolean; dollyRef: VrDollyRef }) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!enabled) return;
    const dolly = new THREE.Group();
    const pos = camera.position.clone();
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    // The dolly carries the ground position and the yaw; the camera
    // keeps only its eye height, facing forward in dolly space.
    dolly.position.set(pos.x, 0, pos.z);
    dolly.rotation.y = euler.y;
    scene.add(dolly);
    camera.position.set(0, pos.y, 0);
    camera.rotation.set(0, 0, 0);
    dolly.add(camera);
    dollyRef.current = dolly;
    return () => {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      camera.getWorldPosition(worldPos);
      camera.getWorldQuaternion(worldQuat);
      scene.add(camera);
      camera.position.copy(worldPos);
      camera.quaternion.copy(worldQuat);
      scene.remove(dolly);
      dollyRef.current = null;
    };
  }, [enabled, camera, scene, dollyRef]);

  return null;
}

/**
 * VrRig — thumbstick walk + primary-button teleport, moving the
 * dolly (see VrDolly). Runs only while a session is presenting;
 * `clamp` optionally keeps the visitor inside the room's walk
 * bounds (the public gallery passes its room bounds; the Twin
 * passes none, as before).
 */
export function VrRig({
  enabled,
  dollyRef,
  clamp,
}: {
  enabled: boolean;
  dollyRef: VrDollyRef;
  clamp?: (position: THREE.Vector3) => void;
}) {
  const gl = useThree((state) => state.gl);
  const buttonWasPressed = useRef(false);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, delta) => {
    const dolly = dollyRef.current;
    if (!enabled || !dolly || !gl.xr.isPresenting) return;
    const session = gl.xr.getSession();
    if (!session) return;
    const dt = Math.min(delta, 0.05);
    // Floor-plane forward from the dolly yaw (the headset owns the
    // look direction; the dolly owns where the visitor stands).
    forward.set(-Math.sin(dolly.rotation.y), 0, -Math.cos(dolly.rotation.y));
    right.crossVectors(forward, up);
    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad) continue;
      const axes = gamepad.axes;
      if (axes.length >= 4) {
        const walk = -(axes[3] ?? 0);
        const strafe = axes[2] ?? 0;
        if (Math.abs(walk) > VR_DEAD_ZONE || Math.abs(strafe) > VR_DEAD_ZONE) {
          dolly.position.addScaledVector(forward, walk * VR_WALK_SPEED_M_S * dt);
          dolly.position.addScaledVector(right, strafe * VR_WALK_SPEED_M_S * dt);
          dolly.position.y = 0;
          clamp?.(dolly.position);
        }
      }
      const pressed = gamepad.buttons[0]?.pressed ?? false;
      if (pressed && !buttonWasPressed.current) {
        // Teleport: 2 m ahead on the floor, at eye height.
        dolly.position.addScaledVector(forward, VR_TELEPORT_M);
        dolly.position.y = 0;
        clamp?.(dolly.position);
      }
      buttonWasPressed.current = pressed;
    }
  });
  return null;
}

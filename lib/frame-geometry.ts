// Real 3D relief geometry for picture frames.
//
// Frames are parametric — they resize to each artwork — so the relief is
// built in code, not shipped as static models:
//  - extruded moulding rings with a chamfered edge (the frame's profile),
//  - real bead spheres along the inner edge (not drawn dots),
//  - merged rosette / scroll ornaments, instanced along the bars
//    (not a drawn carving).
// The canvas textures survive only as fine wood grain; the drawn
// carving and the drawn beads are gone.
import { BufferGeometry, ExtrudeGeometry, InstancedMesh, Object3D, Shape, SphereGeometry, TorusGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// One level of a frame's moulding profile: a ring covering a radial band
// of the bar, from innerFrac to outerFrac of the bar width (measured
// from the opening edge), at depthFrac of the frame's total depth. All
// levels share the frame's back plane; their fronts step down toward
// the artwork, so the steps catch real light and shadow.
export type FrameLevel = { innerFrac: number; outerFrac: number; depthFrac: number };

// Levels for each edge profile. Flat is a single level; stepped drops
// a shallower level toward the artwork; scooped leaves a real groove
// between the levels (the dark tray shows through as the channel).
export function profileLevels(profile: string | undefined): FrameLevel[] {
  if (profile === "stepped") {
    return [
      { innerFrac: 0.45, outerFrac: 1, depthFrac: 1 },
      { innerFrac: 0, outerFrac: 0.45, depthFrac: 0.62 },
    ];
  }
  if (profile === "scooped") {
    return [
      { innerFrac: 0.55, outerFrac: 1, depthFrac: 1 },
      { innerFrac: 0, outerFrac: 0.3, depthFrac: 0.7 },
    ];
  }
  return [{ innerFrac: 0, outerFrac: 1, depthFrac: 1 }];
}

// Chamfer for a ring's edge. Bevelled gets a big 45° chamfer; the rest
// get a small soft edge so the bars are not razor-sharp.
export function profileBevel(profile: string | undefined, w: number, d: number): { size: number; thickness: number; segments: number } {
  if (profile === "bevelled") {
    return { size: Math.min(w * 0.35, 0.025), thickness: Math.min(d * 0.3, 0.02), segments: 3 };
  }
  return { size: Math.min(0.005, w * 0.08), thickness: Math.min(0.005, d * 0.08), segments: 2 };
}

// A rectangular ring (outerW x outerH with an innerW x innerH opening),
// extruded with a chamfered edge. The finished ring spans z in
// [0, depth] and its front face — the face the viewer sees — measures
// exactly outerW x outerH with an opening of innerW x innerH. The
// bevel bulges the body a little behind the front face, so the edge
// reads as a soft rolled moulding rather than a razor-sharp box.
export function frameRingGeometry(
  outerW: number,
  outerH: number,
  innerW: number,
  innerH: number,
  depth: number,
  bevelSize: number,
  bevelThickness: number,
  bevelSegments = 2,
): BufferGeometry {
  const radial = Math.min(outerW - innerW, outerH - innerH) / 2;
  const bs = Math.max(0.0005, Math.min(bevelSize, radial * 0.3, depth * 0.3));
  const bt = Math.max(0.0005, Math.min(bevelThickness, depth * 0.4));
  const shape = new Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();
  const hole = new Shape();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.004, depth - 2 * bt),
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bs,
    bevelSegments,
    curveSegments: 4,
  });
  geo.translate(0, 0, bt);
  return geo;
}

// Evenly spaced points along a rectangle's perimeter (width x height),
// starting half a step into the top edge so no point lands on a corner.
// Used for the bead line (rectangle = the opening) and for the carved
// border (rectangle = the ornament band's centreline).
export function perimeterPositions(width: number, height: number, spacing: number): { x: number; y: number }[] {
  const perimeter = 2 * (width + height);
  if (!(perimeter > 0) || !(spacing > 0)) return [];
  const count = Math.max(8, Math.round(perimeter / spacing));
  const step = perimeter / count;
  const points: { x: number; y: number }[] = [];
  let d = step / 2;
  for (let i = 0; i < count; i += 1) {
    const s = d % perimeter;
    let x = 0;
    let y = 0;
    if (s < width) {
      x = -width / 2 + s;
      y = height / 2;
    } else if (s < width + height) {
      x = width / 2;
      y = height / 2 - (s - width);
    } else if (s < 2 * width + height) {
      x = width / 2 - (s - width - height);
      y = -height / 2;
    } else {
      x = -width / 2;
      y = -height / 2 + (s - 2 * width - height);
    }
    points.push({ x, y });
    d += step;
  }
  return points;
}

// Write position/scale matrices for an instanced mesh from a list of
// points. The instances all face +Z (toward the viewer).
export function setInstancedMatrices(mesh: InstancedMesh, positions: { x: number; y: number }[], z: number, scale: number): void {
  const obj = new Object3D();
  positions.forEach((p, i) => {
    obj.position.set(p.x, p.y, z);
    obj.rotation.set(0, 0, 0);
    obj.scale.setScalar(scale);
    obj.updateMatrix();
    mesh.setMatrixAt(i, obj.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Could not merge frame ornament geometry");
  return merged;
}

function addPart(
  parts: BufferGeometry[],
  geo: BufferGeometry,
  scale: [number, number, number],
  rotate: [number, number, number],
  translate: [number, number, number],
): void {
  geo.scale(scale[0], scale[1], scale[2]);
  geo.rotateX(rotate[0]);
  geo.rotateY(rotate[1]);
  geo.rotateZ(rotate[2]);
  geo.translate(translate[0], translate[1], translate[2]);
  parts.push(geo);
}

let rosette: BufferGeometry | null = null;

// A carved rosette, ~7.5 cm across, dome toward +Z, base at z = 0:
// a centre dome, six petals around it, and an outer ring.
export function rosetteGeometry(): BufferGeometry {
  if (rosette) return rosette;
  const parts: BufferGeometry[] = [];
  addPart(parts, new SphereGeometry(0.016, 20, 14), [1, 1, 0.5], [0, 0, 0], [0, 0, 0.007]);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    addPart(parts, new SphereGeometry(0.011, 14, 10), [1.7, 0.9, 0.45], [0, 0, a], [Math.cos(a) * 0.021, Math.sin(a) * 0.021, 0.004]);
  }
  addPart(parts, new TorusGeometry(0.033, 0.0045, 8, 28), [1, 1, 0.55], [0, 0, 0], [0, 0, 0.002]);
  rosette = mergeParts(parts);
  return rosette;
}

let scroll: BufferGeometry | null = null;

// A carved scroll, ~5 cm across: a half-torus arch with a leaf at one
// foot and a bud at the other.
export function scrollGeometry(): BufferGeometry {
  if (scroll) return scroll;
  const parts: BufferGeometry[] = [];
  addPart(parts, new TorusGeometry(0.02, 0.005, 8, 20, Math.PI), [1, 1, 0.5], [0, 0, 0], [0, 0.004, 0.003]);
  addPart(parts, new SphereGeometry(0.012, 14, 10), [2.2, 0.8, 0.35], [0, 0, 0.6], [0.02, -0.008, 0.003]);
  addPart(parts, new SphereGeometry(0.008, 12, 10), [1, 1, 0.5], [0, 0, 0], [-0.02, -0.008, 0.003]);
  scroll = mergeParts(parts);
  return scroll;
}

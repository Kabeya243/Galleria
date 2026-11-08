// GLB fixture check, run by scripts/test-new-features.mjs
// ("Sculptures 3D / sculpture-glb"): parses the Blender-exported
// sample sculpture with the same GLTFLoader the gallery uses and
// prints its mesh count and bounding box, so the harness can assert
// the file is a valid, floor-based model (base at y = 0).
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";

const buf = readFileSync("scripts/fixtures/sample-sculpture.glb");
console.log("size", buf.length, "magic", buf.subarray(0, 4).toString());
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "",
    resolve,
    reject,
  );
});
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
let meshes = 0;
gltf.scene.traverse((child) => {
  if (child.isMesh) meshes += 1;
});
console.log("parsed OK, meshes:", meshes);
console.log(
  "bbox",
  size.x.toFixed(3),
  size.y.toFixed(3),
  size.z.toFixed(3),
  "max",
  Math.max(size.x, size.y, size.z).toFixed(3),
  "min.y",
  box.min.y.toFixed(3),
);

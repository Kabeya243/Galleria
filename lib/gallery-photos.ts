// Photo textures for the galleries — real JPG photographs stored in
// public/textures (see ATTRIBUTION.md there), loaded once and cached.
// Kabeya's requirement for the eleven galleries from Galeries_3D.html:
// trees (palms, trees) and exterior windows must use real photo
// references, not procedural textures. A photo texture loads
// asynchronously; three.js updates the material automatically once it
// arrives, so builders can use the returned texture immediately. A
// failed load leaves the material's base colour — never a crash.

import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

const cache = new Map<string, Texture>();
const loader = new TextureLoader();

export type PhotoTextureOptions = {
  // Repeat the photo across the surface (lawns, bark).
  repeat?: [number, number];
};

/**
 * A photo from public/textures, as an sRGB texture. Cached: every
 * caller asking for the same file gets the same texture instance.
 */
export function photoTexture(file: string, options?: PhotoTextureOptions): Texture {
  const key = `${file}|${options?.repeat?.join("x") ?? "1x1"}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const texture = loader.load(`/textures/${file}`, (loaded) => {
    loaded.colorSpace = SRGBColorSpace;
    loaded.anisotropy = 8;
    loaded.needsUpdate = true;
  });
  // Set synchronously too: the onLoad callback above runs once the
  // image arrives; the fields below apply as soon as it does.
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // Shared photo texture: disposeGroup must never dispose it (see
  // disposeMaterial in components/gallery-rooms.tsx).
  texture.userData.photoTexture = true;
  if (options?.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  cache.set(key, texture);
  return texture;
}

export const PHOTO = {
  sky: "sky.jpg",
  gardenView: "garden-view.jpg",
  grass: "grass.jpg",
  treeBark: "tree-bark.jpg",
  foliage: "foliage.jpg",
  palmFrond: "palm-frond.jpg",
  palmTrunk: "palm-trunk.jpg",
  glassBrick: "glass-brick.jpg",
} as const;

export type PhotoFile = (typeof PHOTO)[keyof typeof PHOTO];

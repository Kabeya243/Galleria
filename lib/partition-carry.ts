// Artworks carried by a partition wall (Claude's grab / release):
// when a cloison, suspendu or Asset Library partition moves, turns
// or resizes, the artworks hanging on it follow — in the partition's
// local frame. Deleting the partition deletes the artworks hanging on
// it, and removes the wall from the hangable list (the caller rebuilds
// the list from the room's elements, so nothing else is needed).
//
// The local frame: lx runs along the panel (its length), lz off the
// panel face (its thickness), dy above the panel's base (y0 — 0 for a
// cloison, 1.1 for a suspendu). The world ↔ local transform is the
// same one the hang walls use (normal (sin r, cos r), axis
// (cos r, −sin r)).

import type { Artwork } from "@/lib/demo-data";

export type PartitionPose = {
  x: number;
  z: number;
  rotation: number;
  length: number;
  height: number;
  thickness: number;
};

// An artwork hangs on a partition when, in the partition's local
// frame, it sits within the panel's length (plus a small margin),
// close to the panel plane, and within the panel's vertical span
// (y0 … y0 + height). An artwork hangs 0.1 m off the face, so
// |lz| ≈ thickness / 2 + 0.1.
export function artworkOnPartition(artwork: Artwork, partition: PartitionPose, y0 = 0): boolean {
  const dx = artwork.position[0] - partition.x;
  const dz = artwork.position[2] - partition.z;
  const lx = dx * Math.cos(partition.rotation) - dz * Math.sin(partition.rotation);
  const lz = dx * Math.sin(partition.rotation) + dz * Math.cos(partition.rotation);
  return (
    Math.abs(lx) < partition.length / 2 + 0.4 &&
    Math.abs(Math.abs(lz) - partition.thickness / 2) < 0.2 &&
    artwork.position[1] >= y0 - 0.5 &&
    artwork.position[1] < y0 + partition.height + 0.5
  );
}

// The artworks hanging on a partition, right now.
export function carriedArtworks(artworks: Artwork[], partition: PartitionPose, y0 = 0): Artwork[] {
  return artworks.filter((artwork) => artworkOnPartition(artwork, partition, y0));
}

// Grab: the carried artworks' positions in the partition's local
// frame, taken before a move / turn / resize.
export type CarriedArtwork = {
  artwork: Artwork;
  lx: number;
  lz: number;
  dy: number;
  rotation: number;
};

export function grabCarriedArtworks(
  artworks: Artwork[],
  partition: PartitionPose,
  y0: number,
): CarriedArtwork[] {
  return carriedArtworks(artworks, partition, y0).map((artwork) => {
    const dx = artwork.position[0] - partition.x;
    const dz = artwork.position[2] - partition.z;
    return {
      artwork,
      lx: dx * Math.cos(partition.rotation) - dz * Math.sin(partition.rotation),
      lz: dx * Math.sin(partition.rotation) + dz * Math.cos(partition.rotation),
      dy: artwork.position[1] - y0,
      rotation: artwork.rotation - partition.rotation,
    };
  });
}

// Release: the carried artworks' new world transforms after the
// partition moved, turned or resized. Along the panel the offset
// scales with the length (an artwork at 80% of the panel stays at
// 80%); off the panel it is re-anchored to the new face (0.1 m off);
// its height above the base and its rotation relative to the panel
// are kept.
export function releaseCarriedArtworks(
  carried: CarriedArtwork[],
  partition: PartitionPose,
  y0: number,
  oldLength: number,
): { id: string; position: [number, number, number]; rotation: number }[] {
  const cos = Math.cos(partition.rotation);
  const sin = Math.sin(partition.rotation);
  return carried.map((item) => {
    const lx = (item.lx * partition.length) / oldLength;
    const lz = Math.sign(item.lz || 1) * (partition.thickness / 2 + 0.1);
    return {
      id: item.artwork.id,
      position: [
        partition.x + lx * cos + lz * sin,
        y0 + item.dy,
        partition.z - lx * sin + lz * cos,
      ] as [number, number, number],
      rotation: partition.rotation + item.rotation,
    };
  });
}

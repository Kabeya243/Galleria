"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, Suspense } from "react";
import { CanvasTexture, DoubleSide, MathUtils, Object3D, RepeatWrapping, SRGBColorSpace, Texture, Vector3 } from "three";
import type { Artwork } from "@/lib/demo-data";
import { roomLayouts, type GalleryRoom } from "@/lib/rooms";

function createSurfaceTexture(style: string): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  // The map is multiplied by the material colour, so patterns are drawn in
  // near-white with dark lines: the colour tints the surface and the dark
  // joints, seams and veins stay dark, so each finish reads at a glance —
  // including from outside the room, where the same materials face out.
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;

  if (style === "brick") {
    context.fillStyle = "#f7f2e8";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row += 1) {
      const y = row * 32;
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x < 256; x += 64) {
        const shade = 236 + ((row * 7 + x) % 3) * 5;
        context.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
        context.fillRect(x + 2, y + 2, 60, 28);
      }
    }
    context.fillStyle = "#453831";
    for (let row = 0; row <= 8; row += 1) context.fillRect(0, row * 32 - 1, 256, 3);
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x <= 256; x += 64) context.fillRect(x - 1, row * 32, 3, 32);
    }
    texture.repeat.set(6, 3);
  } else if (style === "wood") {
    context.fillStyle = "#f8f2e2";
    context.fillRect(0, 0, 256, 256);
    for (let plank = 0; plank < 8; plank += 1) {
      const y = plank * 32;
      const tone = 232 + (plank % 3) * 8;
      context.fillStyle = `rgb(${tone}, ${tone - 8}, ${tone - 26})`;
      context.fillRect(0, y + 2, 256, 28);
      context.strokeStyle = "rgba(122, 102, 70, 0.5)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y + 12 + (plank % 3) * 4);
      context.bezierCurveTo(80, y + 8, 170, y + 18, 256, y + 12);
      context.stroke();
    }
    context.fillStyle = "#6f5b3f";
    for (let plank = 0; plank <= 8; plank += 1) context.fillRect(0, plank * 32 - 1, 256, 2);
    for (let plank = 0; plank < 8; plank += 1) {
      context.fillRect(plank % 2 ? 170 : 85, plank * 32, 2, 32);
    }
    texture.repeat.set(6, 4);
  } else if (style === "concrete") {
    context.fillStyle = "#f4f1ea";
    context.fillRect(0, 0, 256, 256);
    // Board-formed concrete: a 2 x 2 grid of formwork panels with joints
    // and tie holes, the signature of the reference room.
    context.fillStyle = "#6b655a";
    context.fillRect(0, 127, 256, 3);
    context.fillRect(127, 0, 3, 256);
    context.fillStyle = "#57524a";
    for (const cx of [32, 96, 160, 224]) {
      for (const cy of [32, 96, 160, 224]) {
        context.beginPath();
        context.arc(cx, cy, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    let seed = 41;
    for (let i = 0; i < 950; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 256;
      const shade = 150 + (seed % 70);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.22)`;
      context.fillRect(x, y, 2, 2);
    }
    texture.repeat.set(4, 2);
  } else if (style === "marble") {
    context.fillStyle = "#fbfaf6";
    context.fillRect(0, 0, 256, 256);
    let seed = 97;
    for (let i = 0; i < 9; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const startX = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const startY = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const drift = (seed % 120) - 60;
      context.strokeStyle = i % 3 === 0 ? "rgba(125, 119, 107, 0.75)" : "rgba(164, 158, 146, 0.55)";
      context.lineWidth = i % 3 === 0 ? 1.6 : 1;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(startX + drift, startY + 80, startX - drift, startY + 160, startX + drift / 2, 256);
      context.stroke();
    }
    texture.repeat.set(2, 2);
  } else if (style === "stone") {
    context.fillStyle = "#f3f0e8";
    context.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 2; ty += 1) {
      for (let tx = 0; tx < 2; tx += 1) {
        const shade = 238 + ((tx + ty) % 2) * 6;
        context.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 10})`;
        context.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124);
      }
    }
    context.fillStyle = "#b3ac9c";
    context.fillRect(0, 127, 256, 3);
    context.fillRect(127, 0, 3, 256);
    texture.repeat.set(4, 3);
  } else {
    context.fillStyle = "#f6f3ec";
    context.fillRect(0, 0, 256, 256);
    let seed = 13;
    for (let i = 0; i < 420; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 256;
      const shade = 190 + (seed % 50);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.14)`;
      context.fillRect(x, y, 1, 1);
    }
    texture.repeat.set(2, 2);
  }

  return texture;
}

function GallerySpotlight({ x, y, z, targetZ }: { x: number; y: number; z: number; targetZ: number }) {
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    target.position.set(x, 2.2, targetZ);
    return () => { target.removeFromParent(); };
  }, [target, targetZ, x]);

  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[x, y, z]}
        target={target}
        angle={0.45}
        penumbra={0.75}
        intensity={22}
        distance={14}
        color="#fff0d6"
      />
      <mesh position={[x, y + 0.02, z]}>
        <cylinderGeometry args={[0.2, 0.24, 0.09, 16]} />
        <meshStandardMaterial color="#f4ead5" emissive="#f4ead5" emissiveIntensity={0.65} />
      </mesh>
    </>
  );
}

function LoadedArtwork({ imageUrl }: { imageUrl: string }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[0, 0, 0.083]}>
      <planeGeometry args={[1.82, 2.12]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function ArtworkFrame({
  artwork,
  selected,
  onSelect,
  walkable,
  onWalkTo,
  offsetX,
  dragged,
}: {
  artwork: Artwork;
  selected: boolean;
  onSelect?: (id: string) => void;
  // In walk mode a click walks up to the artwork instead of just selecting
  // it: stand 2.2 m in front of it, facing it. The click still selects the
  // artwork, so its details stay visible in the inspector / info card.
  walkable?: boolean;
  onWalkTo?: (point: Vector3, yaw: number) => void;
  offsetX?: number;
  dragged?: React.RefObject<boolean>;
}) {
  const [x, y, z] = artwork.position;
  return (
    <group
      position={[x, y, z]}
      rotation={[0, artwork.rotation, 0]}
      scale={artwork.scale}
      onClick={(event) => {
        event.stopPropagation();
        if (dragged?.current) return;
        if (walkable && onWalkTo) {
          const nx = Math.sin(artwork.rotation);
          const nz = Math.cos(artwork.rotation);
          onWalkTo(
            new Vector3((offsetX ?? 0) + x + nx * 2.2, 0, z + nz * 2.2),
            Math.atan2(nx, nz),
          );
        }
        onSelect?.(artwork.id);
      }}
    >
      <mesh>
        <boxGeometry args={[2.05, 2.35, 0.12]} />
        <meshStandardMaterial color={selected ? "#aa7958" : "#c5b7a3"} />
      </mesh>
      {artwork.imageUrl ? (
        <LoadedArtwork imageUrl={artwork.imageUrl} />
      ) : (
        <>
          <mesh position={[0, 0, 0.071]}>
            <planeGeometry args={[1.82, 2.12]} />
            <meshStandardMaterial color={artwork.color} />
          </mesh>
          <mesh position={[-0.24, 0.34, 0.082]} rotation={[0, 0, -0.22]}>
            <circleGeometry args={[0.48, 48]} />
            <meshStandardMaterial color={artwork.accent} />
          </mesh>
          <mesh position={[0.28, -0.34, 0.084]} rotation={[0, 0, 0.12]}>
            <planeGeometry args={[0.8, 0.32]} />
            <meshStandardMaterial color="#d7c6a9" />
          </mesh>
        </>
      )}
      {selected && (
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[2.2, 2.5, 0.02]} />
          <meshBasicMaterial color="#bc8056" wireframe />
        </mesh>
      )}
    </group>
  );
}

function WallWithOpening({
  x,
  depth,
  height,
  color,
  texture,
  opening,
}: {
  x: number;
  depth: number;
  height: number;
  color: string;
  texture?: Texture;
  opening: "door" | "window" | "none" | "solid";
}) {
  if (opening === "solid") {
    const wallThickness = 0.22;
    return (
      <mesh position={[x, height / 2, 0]} receiveShadow>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color={color} map={texture} roughness={0.88} />
      </mesh>
    );
  }
  if (opening === "none") return null;
  const wallThickness = 0.22;
  const doorWidth = 1.65;
  const doorHeight = 2.5;
  const windowWidth = 3.2;
  const windowBottom = 1.65;
  const windowTop = Math.min(3.55, height - 0.7);
  const openingWidth = opening === "door" ? doorWidth : windowWidth;
  const openingBottom = opening === "door" ? 0 : windowBottom;
  const openingTop = opening === "door" ? doorHeight : windowTop;
  const sideDepth = (depth - openingWidth) / 2;

  return (
    <group>
      <mesh position={[x, height / 2, -(openingWidth + sideDepth) / 2]} receiveShadow>
        <boxGeometry args={[wallThickness, height, sideDepth]} />
        <meshStandardMaterial color={color} map={texture} roughness={0.88} />
      </mesh>
      <mesh position={[x, height / 2, (openingWidth + sideDepth) / 2]} receiveShadow>
        <boxGeometry args={[wallThickness, height, sideDepth]} />
        <meshStandardMaterial color={color} map={texture} roughness={0.88} />
      </mesh>
      {openingTop < height && (
        <mesh position={[x, (openingTop + height) / 2, 0]} receiveShadow>
          <boxGeometry args={[wallThickness, height - openingTop, openingWidth]} />
          <meshStandardMaterial color={color} map={texture} roughness={0.88} />
        </mesh>
      )}
      {openingBottom > 0 && (
        <mesh position={[x, openingBottom / 2, 0]} receiveShadow>
          <boxGeometry args={[wallThickness, openingBottom, openingWidth]} />
          <meshStandardMaterial color={color} map={texture} roughness={0.88} />
        </mesh>
      )}
      {opening === "door" ? (
        <group>
          {[-doorWidth / 2, doorWidth / 2].map((z) => (
            <mesh key={z} position={[x, doorHeight / 2, z]}>
              <boxGeometry args={[wallThickness * 1.8, doorHeight, 0.1]} />
              <meshStandardMaterial color="#73543d" />
            </mesh>
          ))}
          <mesh position={[x, doorHeight, 0]}>
            <boxGeometry args={[wallThickness * 1.8, 0.12, doorWidth + 0.1]} />
            <meshStandardMaterial color="#73543d" />
          </mesh>
        </group>
      ) : (
        <mesh
          position={[x - Math.sign(x) * 0.02, (windowBottom + windowTop) / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[windowWidth, windowTop - windowBottom]} />
          <meshPhysicalMaterial color="#9bd1db" transparent opacity={0.28} roughness={0.12} side={DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// Built-in furniture of each reference room, derived from the layout only
// (nothing stored per exhibition). Suspended panels, plinths and rails live
// inside the room; the curved wall itself is built in GalleryRoom because
// it replaces the front wall.
function RoomFeatures({
  layout,
  width,
  depth,
  height,
}: {
  layout: string;
  width: number;
  depth: number;
  height: number;
}) {
  if (layout === "cube") {
    // Ceiling track rails running the depth of the room, with spot heads.
    return (
      <group>
        {[-4.5, 0, 4.5].map((x) => (
          <group key={x}>
            <mesh position={[x, height - 0.35, 0]}>
              <boxGeometry args={[0.07, 0.07, depth - 1]} />
              <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-depth / 4, 0, depth / 4].map((z) => (
              <mesh key={z} position={[x, height - 0.45, z]}>
                <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
                <meshStandardMaterial color="#3a3a36" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "grand-hall") {
    // Three white panels suspended from the ceiling by thin rods, plus two
    // plinths carrying dark abstract figures.
    return (
      <group>
        {[-7, 0, 7].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.6, -1]}>
              <boxGeometry args={[3.2, 3.0, 0.12]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.85} />
            </mesh>
            {[-1.3, 1.3].map((dx) => (
              <mesh key={dx} position={[x + dx, (height + 4.1) / 2, -1]}>
                <cylinderGeometry args={[0.02, 0.02, height - 4.1, 6]} />
                <meshStandardMaterial color="#555550" roughness={0.5} metalness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
        {[-4, 4].map((x) => (
          <group key={x} position={[x, 0, 2.5]}>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.9, 1.1, 0.9]} />
              <meshStandardMaterial color="#f2efe8" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <capsuleGeometry args={[0.16, 0.7, 6, 12]} />
              <meshStandardMaterial color="#33332f" roughness={0.4} metalness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "black-panels") {
    // Tall black panels suspended by rods, each carrying a framed
    // black-and-white photograph.
    return (
      <group>
        {[-5.5, 0, 5.5].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.7, -1.5]}>
              <boxGeometry args={[2.2, 3.4, 0.14]} />
              <meshStandardMaterial color="#101010" roughness={0.85} />
            </mesh>
            <mesh position={[x, 2.7, -1.42]}>
              <planeGeometry args={[1.7, 2.6]} />
              <meshStandardMaterial color="#d8d5cc" roughness={0.9} />
            </mesh>
            <mesh position={[x, 2.9, -1.41]}>
              <circleGeometry args={[0.5, 32]} />
              <meshStandardMaterial color="#1c1c1a" roughness={0.9} />
            </mesh>
            {[-0.8, 0.8].map((dx) => (
              <mesh key={dx} position={[x + dx, (height + 4.4) / 2, -1.5]}>
                <cylinderGeometry args={[0.02, 0.02, height - 4.4, 6]} />
                <meshStandardMaterial color="#444440" roughness={0.5} metalness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "raw-concrete") {
    // Seven freestanding black-framed panels in a staggered (quincunx) row.
    const panels: [number, number][] = [[-6, -3], [0, -3], [6, -3], [-3, 0], [3, 0], [-6, 3], [6, 3]];
    return (
      <group>
        {panels.map(([x, z], index) => (
          <group key={index} position={[x, 0, z]}>
            <mesh position={[0, 1.35, 0]}>
              <boxGeometry args={[1.7, 2.5, 0.1]} />
              <meshStandardMaterial color="#171716" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.35, 0.06]}>
              <planeGeometry args={[1.5, 2.3]} />
              <meshStandardMaterial color="#e8e6e0" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.5, 0.07]}>
              <circleGeometry args={[0.45, 32]} />
              <meshStandardMaterial color="#232320" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "parquet-portraits") {
    // Ceiling track rails with spot heads, as in the reference room.
    return (
      <group>
        {[-3.5, 3.5].map((x) => (
          <group key={x}>
            <mesh position={[x, height - 0.35, 0]}>
              <boxGeometry args={[0.07, 0.07, depth - 1]} />
              <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-depth / 4, 0, depth / 4].map((z) => (
              <mesh key={z} position={[x, height - 0.45, z]}>
                <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
                <meshStandardMaterial color="#3a3a36" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "curved-wall") {
    // Seven hanging spots along the arc of the curved front wall.
    const curveRadius = 40;
    const halfAngle = Math.asin(Math.min(0.95, width / 2 / curveRadius));
    const centerZ = depth / 2 - curveRadius * Math.cos(halfAngle);
    const tones = ["#8a9b88", "#bb8365", "#8796a9", "#a89a7a", "#7d8a99", "#b0855b", "#94a08e"];
    return (
      <group>
        {Array.from({ length: 7 }, (_, index) => {
          const theta = -halfAngle * 0.75 + (index * (halfAngle * 1.5)) / 6;
          const r = curveRadius - 0.15;
          const x = r * Math.sin(theta);
          const z = centerZ + r * Math.cos(theta);
          return (
            <group key={index} position={[x, 2.3, z]} rotation={[0, theta + Math.PI, 0]}>
              <mesh>
                <boxGeometry args={[1.5, 1.9, 0.1]} />
                <meshStandardMaterial color="#c5b7a3" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0, 0.06]}>
                <planeGeometry args={[1.3, 1.7]} />
                <meshStandardMaterial color={tones[index]} roughness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }
  if (layout === "marble-sculpture") {
    // Bronze figures on black and white plinths.
    return (
      <group>
        {[
          { x: -4, z: -1, plinth: "#171716" },
          { x: 0, z: 1.5, plinth: "#f2efe8" },
          { x: 4, z: -2, plinth: "#171716" },
        ].map(({ x, z, plinth }) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={[0.9, 1.2, 0.9]} />
              <meshStandardMaterial color={plinth} roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.75, 0]}>
              <cylinderGeometry args={[0.12, 0.22, 1.1, 16]} />
              <meshStandardMaterial color="#6b5433" roughness={0.45} metalness={0.6} />
            </mesh>
            <mesh position={[0, 2.44, 0]}>
              <sphereGeometry args={[0.15, 20, 16]} />
              <meshStandardMaterial color="#6b5433" roughness={0.45} metalness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "quiet-minimal") {
    // A single wooden bench and ceiling track rails, nothing else.
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[2.2, 0.12, 0.7]} />
          <meshStandardMaterial color="#8a6a45" roughness={0.8} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.21, 0]}>
            <boxGeometry args={[0.08, 0.42, 0.6]} />
            <meshStandardMaterial color="#6b4f33" roughness={0.8} />
          </mesh>
        ))}
        {[-3, 3].map((x) => (
          <group key={x}>
            <mesh position={[x, height - 0.35, 0]}>
              <boxGeometry args={[0.07, 0.07, depth - 1]} />
              <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-depth / 4, 0, depth / 4].map((z) => (
              <mesh key={z} position={[x, height - 0.45, z]}>
                <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
                <meshStandardMaterial color="#3a3a36" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "pop-brick") {
    // Three loud colour accents on the back wall.
    return (
      <group>
        {[
          { x: -4, color: "#ff4d2e" },
          { x: 0, color: "#f5c518" },
          { x: 4, color: "#2e6fb0" },
        ].map(({ x, color }) => (
          <mesh key={x} position={[x, 2.4, -depth / 2 + 0.16]}>
            <planeGeometry args={[2.2, 2.6]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  if (layout === "totem-studio") {
    // Works suspended from the ceiling by thin cables, plus two plinths.
    return (
      <group>
        {[
          { x: -5, z: -2 },
          { x: 0, z: 0.5 },
          { x: 5, z: -2 },
          { x: -2.5, z: 2.5 },
        ].map(({ x, z }, index) => (
          <group key={index} position={[x, 0, z]}>
            <mesh position={[0, 2.2, 0]}>
              <boxGeometry args={[1.3, 1.6, 0.08]} />
              <meshStandardMaterial color={["#8a9b88", "#bb8365", "#8796a9", "#a89a7a"][index]} roughness={0.9} />
            </mesh>
            <mesh position={[0, (height + 3.0) / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, height - 3.0, 6]} />
              <meshStandardMaterial color="#555550" roughness={0.5} metalness={0.5} />
            </mesh>
          </group>
        ))}
        {[-6, 6].map((x) => (
          <mesh key={x} position={[x, 0.5, 3]}>
            <boxGeometry args={[0.9, 1.0, 0.9]} />
            <meshStandardMaterial color="#f2efe8" roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

function GalleryRoom({
  room,
  offsetX,
  artworks,
  selectedId,
  onSelect,
  walkable,
  onFloorClick,
  onWalkTo,
  dragged,
  leftOpening,
  rightOpening,
  entrance,
}: {
  room: GalleryRoom;
  offsetX: number;
  artworks: Artwork[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  walkable: boolean;
  onFloorClick?: (point: Vector3) => void;
  onWalkTo?: (point: Vector3, yaw: number) => void;
  dragged?: React.RefObject<boolean>;
  leftOpening: "door" | "window" | "none" | "solid";
  rightOpening: "door" | "window" | "solid";
  entrance: boolean;
}) {
  const { width, depth, height } = roomLayouts[room.layout];
  const wallZ = -depth / 2;
  // The curved room's front wall is a real arc, not a flat box face: it
  // bulges toward the viewer, so the curve reads from the outside orbit
  // view as well as from inside. Floor and ceiling extend to cover it.
  const isCurved = room.layout === "curved-wall";
  const curveRadius = 40;
  const curveHalfAngle = Math.asin(Math.min(0.95, width / 2 / curveRadius));
  const curveSagitta = curveRadius - curveRadius * Math.cos(curveHalfAngle);
  const curveCenterZ = depth / 2 - curveRadius * Math.cos(curveHalfAngle);
  const roomDepth = isCurved ? depth + curveSagitta : depth;
  const roomDepthCenter = isCurved ? curveSagitta / 2 : 0;
  const wallTexture = useMemo(() => createSurfaceTexture(room.wallTexture), [room.wallTexture]);
  const floorTexture = useMemo(() => createSurfaceTexture(room.floorTexture), [room.floorTexture]);
  const ceilingTexture = useMemo(() => createSurfaceTexture(room.ceilingTexture), [room.ceilingTexture]);
  useEffect(() => () => {
    wallTexture?.dispose();
    floorTexture?.dispose();
    ceilingTexture?.dispose();
  }, [ceilingTexture, floorTexture, wallTexture]);
  const artworkNodes = useMemo(
    () =>
      artworks.map((artwork) => (
        <ArtworkFrame
          key={artwork.id}
          artwork={artwork}
          selected={artwork.id === selectedId}
          onSelect={onSelect}
          walkable={walkable}
          onWalkTo={onWalkTo}
          offsetX={offsetX}
          dragged={dragged}
        />
      )),
    [artworks, dragged, offsetX, onSelect, onWalkTo, selectedId, walkable],
  );

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh position={[0, height - 0.12, roomDepthCenter]} receiveShadow>
        <boxGeometry args={[width, 0.24, roomDepth]} />
        <meshStandardMaterial color={room.ceilingColor} map={ceilingTexture} roughness={0.9} />
      </mesh>
      <mesh
        position={[0, -0.09, roomDepthCenter]}
        receiveShadow
        onClick={(event) => {
          if (!walkable || dragged?.current) return;
          event.stopPropagation();
          onFloorClick?.(event.point);
        }}
      >
        <boxGeometry args={[width, 0.18, roomDepth]} />
        <meshStandardMaterial attach="material-0" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-2" color={room.floorColor} map={floorTexture} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-4" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-5" color={room.floorColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, height / 2, wallZ]} receiveShadow>
        <boxGeometry args={[width, height, 0.25]} />
        <meshStandardMaterial color={room.wallColor} map={wallTexture} roughness={0.88} />
      </mesh>
      <WallWithOpening
        x={-width / 2}
        depth={depth}
        height={height}
        color={room.sideWallColor}
        texture={wallTexture}
        opening={leftOpening}
      />
      <WallWithOpening
        x={width / 2}
        depth={depth}
        height={height}
        color={room.sideWallColor}
        texture={wallTexture}
        opening={rightOpening}
      />
      {isCurved ? (
        <mesh position={[0, height / 2, curveCenterZ]} receiveShadow>
          <cylinderGeometry args={[curveRadius, curveRadius, height, 64, 1, true, -curveHalfAngle, curveHalfAngle * 2]} />
          <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} side={DoubleSide} />
        </mesh>
      ) : entrance ? (
        <group position={[0, 0, depth / 2]}>
          <mesh position={[-(width + 1.65) / 4, height / 2, 0]} receiveShadow>
            <boxGeometry args={[(width - 1.65) / 2, height, 0.22]} />
            <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} />
          </mesh>
          <mesh position={[(width + 1.65) / 4, height / 2, 0]} receiveShadow>
            <boxGeometry args={[(width - 1.65) / 2, height, 0.22]} />
            <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} />
          </mesh>
          <mesh position={[0, (height + 2.5) / 2, 0]} receiveShadow>
            <boxGeometry args={[1.65, height - 2.5, 0.22]} />
            <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, height / 2, depth / 2]} receiveShadow>
          <boxGeometry args={[width, height, 0.22]} />
          <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} />
        </mesh>
      )}
      {room.partitionWalls.map((wall) => (
        <mesh key={wall.id} position={[wall.x, (height - 0.25) / 2, wall.z]} receiveShadow castShadow>
          <boxGeometry
            args={wall.orientation === "horizontal"
              ? [wall.length, height - 0.25, 0.18]
              : [0.18, height - 0.25, wall.length]}
          />
          <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.88} />
        </mesh>
      ))}
      {room.spotlights && Array.from({ length: Math.max(2, Math.floor(width / 5)) }, (_, index) => {
        const spots = Math.max(2, Math.floor(width / 5));
        const x = -width / 2 + ((index + 1) * width) / (spots + 1);
        return <GallerySpotlight key={index} x={x} y={height - 0.2} z={0} targetZ={wallZ + 1} />;
      })}
      {room.curatorialText && (
        <group position={[0, height - 0.65, wallZ + 0.14]}>
          <mesh position={[0, 0, -0.015]}>
            <planeGeometry args={[Math.min(width - 1.5, 10), 0.8]} />
            <meshBasicMaterial color={room.wallColor} />
          </mesh>
          <Text
            fontSize={0.15}
            maxWidth={Math.min(width - 2, 9)}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
            color="#252722"
          >
            {room.curatorialText}
          </Text>
        </group>
      )}
      <RoomFeatures layout={room.layout} width={width} depth={depth} height={height} />
      {artworkNodes}
    </group>
  );
}

// Live walk-mode state, written by WalkControls every frame when a debug
// ref is provided (only used with ?debug=walk on the public exhibition).
export type WalkDebugState = {
  enabled: boolean;
  keys: string[];
  destination: [number, number, number] | null;
  camera: [number, number, number] | null;
  lastKey: string | null;
};

function WalkControls({
  rooms,
  activeRoomId,
  offsets,
  input,
  destination,
  lookYaw,
  dragged,
  enabled,
  onRoomChange,
  debugState,
}: {
  rooms: GalleryRoom[];
  activeRoomId: string;
  offsets: number[];
  input: React.RefObject<Set<string>>;
  destination: React.RefObject<Vector3 | null>;
  // Yaw to face once the destination is reached (e.g. an artwork just
  // clicked): the camera turns toward it while walking.
  lookYaw: React.RefObject<number | null>;
  // Set while the pointer drags (look around): a drag must not also count
  // as a click-to-walk on the floor or an artwork.
  dragged: React.RefObject<boolean>;
  enabled: boolean;
  onRoomChange?: (id: string) => void;
  debugState?: React.RefObject<WalkDebugState | null>;
}) {
  const { camera, gl } = useThree();
  const currentRoomIndex = useRef(Math.max(0, rooms.findIndex((room) => room.id === activeRoomId)));
  const handledRoomId = useRef(activeRoomId);
  const initialized = useRef(false);
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());
  const stuckTime = useRef(0);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      const startIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoomId));
      const startRoom = rooms[startIndex];
      camera.position.set(offsets[startIndex], 1.65, roomLayouts[startRoom.layout].depth / 2 - 1.5);
      camera.rotation.set(0, 0, 0);
      currentRoomIndex.current = startIndex;
      handledRoomId.current = activeRoomId;
      initialized.current = true;
      return;
    }
    const requestedIndex = rooms.findIndex((room) => room.id === activeRoomId);
    if (requestedIndex < 0 || handledRoomId.current === activeRoomId) return;
    const room = rooms[requestedIndex];
    const { depth } = roomLayouts[room.layout];
    camera.position.set(
      offsets[requestedIndex],
      1.65,
      depth / 2 - 1.5,
    );
    camera.rotation.set(0, 0, 0);
    currentRoomIndex.current = requestedIndex;
    handledRoomId.current = activeRoomId;
  }, [activeRoomId, camera, offsets, rooms]);

  useEffect(() => {
    if (!enabled) {
      input.current.clear();
      return;
    }
    gl.domElement.tabIndex = 0;
    gl.domElement.focus({ preventScroll: true });
    const keyDown = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        input.current.add(event.code);
        lastKey.current = event.code;
      }
    };
    const keyUp = (event: KeyboardEvent) => input.current.delete(event.code);
    const clearKeys = () => input.current.clear();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearKeys);

    let pointerId: number | undefined;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      downX = event.clientX;
      downY = event.clientY;
      dragged.current = false;
      gl.domElement.setPointerCapture(pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (Math.abs(event.clientX - downX) > 6 || Math.abs(event.clientY - downY) > 6) {
        dragged.current = true;
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y -= (event.clientX - lastX) * 0.004;
      camera.rotation.x = MathUtils.clamp(camera.rotation.x - (event.clientY - lastY) * 0.004, -1.35, 1.35);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => { pointerId = undefined; };
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("pointerup", onPointerUp);
    gl.domElement.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearKeys);
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onPointerUp);
      gl.domElement.removeEventListener("pointercancel", onPointerUp);
    };
  }, [camera, dragged, enabled, gl, input]);

  useFrame((_, delta) => {
    if (debugState) {
      debugState.current = {
        enabled,
        keys: [...input.current],
        destination: destination.current
          ? [destination.current.x, destination.current.y, destination.current.z]
          : null,
        camera: [camera.position.x, camera.position.y, camera.position.z],
        lastKey: lastKey.current,
      };
    }
    if (!enabled) return;
    const keys = input.current;
    const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const sideInput = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const destinationPoint = destination.current;
    if (!forwardInput && !sideInput && !destinationPoint) return;

    if (forwardInput || sideInput) {
      destination.current = null;
      lookYaw.current = null;
      direction.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      direction.current.y = 0;
      direction.current.normalize();
      right.current.crossVectors(direction.current, camera.up).normalize();
      velocity.current.set(0, 0, 0)
        .addScaledVector(direction.current, forwardInput)
        .addScaledVector(right.current, sideInput)
        .normalize();
    } else if (destinationPoint) {
      direction.current.set(destinationPoint.x - camera.position.x, 0, destinationPoint.z - camera.position.z);
      if (direction.current.length() < 0.2) {
        destination.current = null;
        lookYaw.current = null;
        return;
      }
      direction.current.normalize();
      velocity.current.copy(direction.current);
      // Turn to face the destination (e.g. the artwork just clicked) while
      // walking toward it.
      if (lookYaw.current !== null) {
        const step = Math.min(delta, 0.05) * 2.5;
        let diff = lookYaw.current - camera.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        camera.rotation.y += MathUtils.clamp(diff, -step, step);
      }
    }
    velocity.current.multiplyScalar(Math.min(delta, 0.05) * 4);
    const startX = camera.position.x;
    const startZ = camera.position.z;

    const roomIndex = currentRoomIndex.current;
    const room = rooms[roomIndex];
    const { width, depth } = roomLayouts[room.layout];
    let nextX = camera.position.x + velocity.current.x;
    let nextZ = camera.position.z + velocity.current.z;
    const localX = camera.position.x - offsets[roomIndex];
    const targetX = nextX - offsets[roomIndex];
    for (const wall of room.partitionWalls) {
      if (wall.orientation === "horizontal") {
        const crossesWall = Math.min(camera.position.z, nextZ) <= wall.z + 0.2
          && Math.max(camera.position.z, nextZ) >= wall.z - 0.2;
        const overlapsWall = Math.min(localX, targetX) <= wall.x + wall.length / 2 + 0.35
          && Math.max(localX, targetX) >= wall.x - wall.length / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextZ = camera.position.z;
        }
      } else {
        const crossesWall = Math.min(localX, targetX) <= wall.x + 0.2
          && Math.max(localX, targetX) >= wall.x - 0.2;
        const overlapsWall = Math.min(camera.position.z, nextZ) <= wall.z + wall.length / 2 + 0.35
          && Math.max(camera.position.z, nextZ) >= wall.z - wall.length / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextX = camera.position.x;
        }
      }
    }
    const leftEdge = offsets[roomIndex] - width / 2 + 0.45;
    const rightEdge = offsets[roomIndex] + width / 2 - 0.45;
    const frontEdge = depth / 2 - 0.45;
    const backEdge = -depth / 2 + 0.55;

    if (nextZ <= frontEdge && nextZ >= backEdge) camera.position.z = nextZ;
    if (nextX >= leftEdge && nextX <= rightEdge) {
      camera.position.x = nextX;
      return;
    }

    const nextIndex = nextX < leftEdge ? roomIndex - 1 : roomIndex + 1;
    if (Math.abs(camera.position.z) < 0.9 && nextIndex >= 0 && nextIndex < rooms.length) {
      const { width: nextWidth } = roomLayouts[rooms[nextIndex].layout];
      camera.position.x = offsets[nextIndex] + (nextX < leftEdge ? 1 : -1) * (nextWidth / 2 - 3);
      camera.rotation.set(0, 0, 0);
      destination.current = null;
      lookYaw.current = null;
      currentRoomIndex.current = nextIndex;
      handledRoomId.current = rooms[nextIndex].id;
      onRoomChange?.(rooms[nextIndex].id);
      return;
    }
    camera.position.x = MathUtils.clamp(nextX, leftEdge, rightEdge);

    // Give up on a destination the visitor cannot reach (blocked by a wall):
    // otherwise the camera would keep pushing against it forever.
    if (destination.current) {
      if (Math.abs(camera.position.x - startX) < 0.001 && Math.abs(camera.position.z - startZ) < 0.001) {
        stuckTime.current += delta;
        if (stuckTime.current > 1.5) {
          destination.current = null;
          lookYaw.current = null;
          stuckTime.current = 0;
        }
      } else {
        stuckTime.current = 0;
      }
    }
  });

  return null;
}

// Interior orbit limits: the camera stays inside the room. The orbit radius
// never reaches a wall, and the polar band keeps the camera between floor
// and ceiling, so the room always reads as an interior — never as a flat
// field of colour, and never as a closed box seen from outside.
function interiorOrbitLimits(width: number, depth: number, height: number) {
  const maxDistance = Math.min(width, depth) / 2 - 0.6;
  const eyeY = 1.8;
  const topCos = Math.min(0.99, (height - 0.4 - eyeY) / maxDistance);
  const bottomCos = Math.max(-0.99, (0.4 - eyeY) / maxDistance);
  return {
    maxDistance,
    minPolarAngle: Math.acos(topCos),
    maxPolarAngle: Math.acos(bottomCos),
  };
}

// When the active room changes, put the camera back inside the new room:
// at the entrance, eye height, looking at the room's centre. Without this
// the camera would stay wherever the previous room left it — possibly
// outside the new room's walls.
function InteriorCameraRig({
  roomKey,
  depth,
  enabled,
}: {
  roomKey: string;
  depth: number;
  enabled: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target: Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    if (!enabled) return;
    camera.position.set(0, 2.0, depth / 2 - 1.8);
    if (controls) {
      controls.target.set(0, 1.8, 0);
      controls.update();
    } else {
      camera.lookAt(0, 1.8, 0);
    }
  }, [camera, controls, depth, enabled, roomKey]);
  return null;
}

export default function GalleryScene({
  artworks,
  selectedId,
  onSelect,
  className,
  room,
  rooms,
  walkMode = false,
  activeRoomId,
  onRoomChange,
  input,
  onFloorClick,
  walking,
  interior = false,
  debugState,
}: {
  artworks: Artwork[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  room: GalleryRoom;
  rooms?: GalleryRoom[];
  walkMode?: boolean;
  activeRoomId?: string;
  onRoomChange?: (id: string) => void;
  input?: React.RefObject<Set<string>>;
  onFloorClick?: (point: Vector3) => void;
  walking?: boolean;
  debugState?: React.RefObject<WalkDebugState | null>;
  // Interior view: the camera starts inside the room and orbits from within,
  // so the visitor arrives directly in the gallery instead of looking at a
  // closed box from outside. The exterior (garden, doors, buildings) is a
  // later phase: the room boxes stay intact, only the viewpoint changes.
  interior?: boolean;
}) {
  const sceneRooms = rooms?.length ? rooms : [room];
  const offsets = useMemo(() => {
    let current = 0;
    return sceneRooms.map((sceneRoom, index) => {
      if (index > 0) {
        const previousWidth = roomLayouts[sceneRooms[index - 1].layout].width;
        const currentWidth = roomLayouts[sceneRoom.layout].width;
        current += (previousWidth + currentWidth) / 2;
      }
      return current;
    });
  }, [sceneRooms]);

  const artworkRooms = walkMode ? sceneRooms : [room];
  const artworkOffsets = walkMode ? offsets : [0];
  const destination = useRef<Vector3 | null>(null);
  const lookYaw = useRef<number | null>(null);
  const dragged = useRef(false);
  const artworkNodes = artworkRooms.map((sceneRoom, index) => (
    <GalleryRoom
      key={sceneRoom.id}
      room={sceneRoom}
      offsetX={artworkOffsets[index]}
      artworks={artworks.filter((artwork) => artwork.roomId === sceneRoom.id)}
      selectedId={selectedId}
      onSelect={onSelect}
      walkable={walkMode && walking === true && sceneRoom.id === (activeRoomId ?? room.id)}
      onFloorClick={walkMode ? (point) => {
        destination.current = new Vector3(point.x, 0, point.z);
        lookYaw.current = null;
        onFloorClick?.(point);
      } : undefined}
      onWalkTo={walkMode ? (point, yaw) => {
        destination.current = point;
        lookYaw.current = yaw;
      } : undefined}
      dragged={dragged}
      // In walk mode the visitor stays inside: shared walls keep the single
      // door wall (no doubled wall, so no z-fighting), the outer ends are
      // solid and the front stays closed, so no void or box exterior is
      // ever visible through a window or an entrance hole.
      leftOpening={walkMode ? (index > 0 ? "none" : "solid") : "window"}
      rightOpening={walkMode ? (index < sceneRooms.length - 1 ? "door" : "solid") : "window"}
      entrance={false}
    />
  ));
  const startRoom = sceneRooms[Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)))];
  const startIndex = Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)));
  const startOffset = offsets[startIndex];
  const startDepth = roomLayouts[startRoom.layout].depth;
  const interiorView = interior === true && !walkMode;
  const interiorLimits = useMemo(() => {
    const layout = roomLayouts[room.layout];
    return interiorOrbitLimits(layout.width, layout.depth, layout.height);
  }, [room.layout]);

  return (
    <div className={`${className ?? "gallery-canvas"}${walkMode && walking ? " is-walking" : ""}`}>
      <Canvas camera={{ position: interiorView ? [0, 2.0, startDepth / 2 - 1.8] : walkMode ? [startOffset, 1.65, startDepth / 2 - 1.5] : [0, 3.2, 11], fov: interiorView ? 60 : walkMode ? 75 : 43 }} dpr={[1, 1.6]} shadows>
        <color attach="background" args={[room.wallColor]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[-3, 8, 4]} intensity={1.8} />
        {sceneRooms.map((sceneRoom, index) => <pointLight key={`light-${sceneRoom.id}`} position={[offsets[index], 4, -2]} intensity={0.55} color="#f4d8b8" />)}
        {/* Artwork textures load through Suspense so a slow image suspends
            only the artworks — never the whole room or page. */}
        <Suspense fallback={null}>{artworkNodes}</Suspense>
        {interiorView && (
          <InteriorCameraRig roomKey={`${room.id}:${room.layout}`} depth={startDepth} enabled />
        )}
        {walkMode && input ? (
          <WalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} input={input} destination={destination} lookYaw={lookYaw} dragged={dragged} enabled={walking ?? false} onRoomChange={onRoomChange} debugState={debugState} />
        ) : (
          <OrbitControls
            makeDefault
            minDistance={interiorView ? 1.2 : 4}
            maxDistance={interiorView ? interiorLimits.maxDistance : Math.max(roomLayouts[room.layout].width, roomLayouts[room.layout].depth) + 6}
            minPolarAngle={interiorView ? interiorLimits.minPolarAngle : 0}
            maxPolarAngle={interiorView ? interiorLimits.maxPolarAngle : Math.PI / 2.03}
            target={interiorView ? [0, 1.8, 0] : [0, 2.1, -roomLayouts[room.layout].depth / 2]}
            enableDamping
          />
        )}
      </Canvas>
    </div>
  );
}

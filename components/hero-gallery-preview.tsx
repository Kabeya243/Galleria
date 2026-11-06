"use client";

// Simplified live 3D preview of a real SANAA gallery room for the landing
// hero: a white-cube corner with the featured exhibition's real artworks
// (real image URLs from the database), soft museum lighting, and a slow
// camera sway. It is a preview, not the full viewer — no walk controls,
// no editor logic, no quality toggle. Clicking it goes to the exhibition.

import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Object3D, SRGBColorSpace } from "three";

export type HeroPreviewArtwork = {
  id: string;
  title: string;
  imageUrl: string;
};

// White-cube corner: 7 m wide, 5.5 m deep, 3.2 m high. The camera stands
// outside the open side and looks in, like the mockup.
const ROOM_WIDTH = 7;
const ROOM_DEPTH = 5.5;
const ROOM_HEIGHT = 3.2;
const BACK_Z = -2;
const FRONT_Z = 3.5;
const CENTER_Z = 0.75;
const ARTWORK_HEIGHT = 1.25;

function MuseumSpot({
  position,
  tx,
  ty,
  tz,
}: {
  position: [number, number, number];
  tx: number;
  ty: number;
  tz: number;
}) {
  const targetObject = useMemo(() => {
    const object = new Object3D();
    object.position.set(tx, ty, tz);
    return object;
  }, [tx, ty, tz]);
  return (
    <>
      <primitive object={targetObject} />
      <spotLight
        position={position}
        target={targetObject}
        angle={0.5}
        penumbra={0.85}
        intensity={12}
        distance={12}
        decay={2}
        color="#fff2df"
      />
    </>
  );
}

function PreviewArtwork({
  imageUrl,
  position,
  rotationY,
}: {
  imageUrl: string;
  position: [number, number, number];
  rotationY: number;
}) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = SRGBColorSpace;
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 0.75;
  const width = Math.min(ARTWORK_HEIGHT * aspect, 1.7);
  const frameWidth = width + 0.12;
  const frameHeight = ARTWORK_HEIGHT + 0.12;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, -0.02]} castShadow>
        <boxGeometry args={[frameWidth, frameHeight, 0.05]} />
        <meshStandardMaterial color="#111111" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[width, ARTWORK_HEIGHT]} />
        <meshStandardMaterial map={texture} roughness={0.85} metalness={0} />
      </mesh>
    </group>
  );
}

function PreviewRoom() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, CENTER_Z]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color="#f2f2ef" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, ROOM_HEIGHT / 2, BACK_Z]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0} />
      </mesh>
      <mesh
        position={[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, CENTER_Z]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#fafafa" roughness={0.95} metalness={0} />
      </mesh>
      <mesh
        position={[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, CENTER_Z]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#fafafa" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

// Gentle continuous sway: the camera drifts side to side so the preview
// feels alive, but it never leaves the view of the three artworks.
function CameraRig() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const azimuth = 0.24 * Math.sin(t * 0.16);
    const radius = 5.6;
    const targetX = 0;
    const targetY = 1.45;
    const targetZ = 0.4;
    camera.position.set(
      targetX + radius * Math.sin(azimuth),
      2.15,
      targetZ + radius * Math.cos(azimuth),
    );
    camera.lookAt(targetX, targetY, targetZ);
  });
  return null;
}

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const SLOTS: { position: [number, number, number]; rotationY: number }[] = [
  { position: [0, 1.55, -1.95], rotationY: 0 },
  { position: [-3.44, 1.55, 0.75], rotationY: Math.PI / 2 },
  { position: [3.44, 1.55, 0.75], rotationY: -Math.PI / 2 },
];

export default function HeroGalleryPreview({ artworks }: { artworks: HeroPreviewArtwork[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const placed = artworks.slice(0, 3).map((artwork, index) => ({ artwork, ...SLOTS[index] }));

  return (
    <PreviewErrorBoundary>
      <div style={{ position: "absolute", inset: 0 }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 2.15, 6], fov: 42, near: 0.1, far: 60 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[4, 6, 6]}
            intensity={1.0}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={7}
            shadow-camera-bottom={-7}
            shadow-camera-near={1}
            shadow-camera-far={20}
            shadow-bias={-0.0002}
          />
          <MuseumSpot position={[0, 3.0, 0.4]} tx={0} ty={1.55} tz={-2} />
          <MuseumSpot position={[-1.6, 3.0, 0.75]} tx={-3.5} ty={1.55} tz={0.75} />
          <MuseumSpot position={[1.6, 3.0, 0.75]} tx={3.5} ty={1.55} tz={0.75} />
          <PreviewRoom />
          <Suspense fallback={null}>
            {placed.map((entry) => (
              <PreviewArtwork
                key={entry.artwork.id}
                imageUrl={entry.artwork.imageUrl}
                position={entry.position}
                rotationY={entry.rotationY}
              />
            ))}
          </Suspense>
          <CameraRig />
        </Canvas>
      </div>
    </PreviewErrorBoundary>
  );
}

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
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

  context.fillStyle = "#eeeeeb";
  context.fillRect(0, 0, 256, 256);
  if (style === "brick") {
    context.fillStyle = "#a9a49c";
    for (let row = 0; row < 8; row += 1) {
      const y = row * 32;
      context.fillRect(0, y, 256, 3);
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x < 256; x += 64) context.fillRect(x, y, 3, 32);
    }
  } else if (style === "wood") {
    context.fillStyle = "#a9a49c";
    for (let y = 0; y < 256; y += 64) {
      context.fillRect(0, y, 256, 2);
      for (let x = (y / 64 % 2) * 64; x < 256; x += 128) context.fillRect(x, y, 2, 64);
      context.strokeStyle = "#d0ccc4";
      context.beginPath();
      context.moveTo(0, y + 18);
      context.bezierCurveTo(72, y + 12, 144, y + 25, 256, y + 16);
      context.stroke();
    }
  } else {
    let seed = style === "concrete" ? 41 : 13;
    for (let i = 0; i < (style === "concrete" ? 950 : 420); i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 256;
      const shade = style === "concrete" ? 145 + (seed % 70) : 190 + (seed % 50);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${style === "concrete" ? 0.24 : 0.14})`;
      context.fillRect(x, y, style === "concrete" ? 2 : 1, style === "concrete" ? 2 : 1);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 2);
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
}: {
  artwork: Artwork;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const [x, y, z] = artwork.position;
  return (
    <group
      position={[x, y, z]}
      rotation={[0, artwork.rotation, 0]}
      scale={artwork.scale}
      onClick={(event) => {
        event.stopPropagation();
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
  opening: "door" | "window" | "none";
}) {
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

function GalleryRoom({
  room,
  offsetX,
  artworks,
  selectedId,
  onSelect,
  walkable,
  onFloorClick,
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
  leftOpening: "door" | "window" | "none";
  rightOpening: "door" | "window";
  entrance: boolean;
}) {
  const { width, depth, height } = roomLayouts[room.layout];
  const wallZ = -depth / 2;
  const wallTexture = useMemo(() => createSurfaceTexture(room.wallTexture), [room.wallTexture]);
  const floorTexture = useMemo(() => createSurfaceTexture(room.floorTexture), [room.floorTexture]);
  useEffect(() => () => {
    wallTexture?.dispose();
    floorTexture?.dispose();
  }, [floorTexture, wallTexture]);
  const artworkNodes = useMemo(
    () =>
      artworks.map((artwork) => (
        <ArtworkFrame
          key={artwork.id}
          artwork={artwork}
          selected={artwork.id === selectedId}
          onSelect={onSelect}
        />
      )),
    [artworks, onSelect, selectedId],
  );

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh position={[0, height - 0.12, 0]} receiveShadow>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshStandardMaterial color={room.sideWallColor} map={wallTexture} roughness={0.9} />
      </mesh>
      <mesh
        position={[0, -0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(event) => {
          if (!walkable) return;
          event.stopPropagation();
          onFloorClick?.(event.point);
        }}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={room.floorColor} map={floorTexture} roughness={0.9} />
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
      {entrance ? (
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
      {artworkNodes}
    </group>
  );
}

function WalkControls({
  rooms,
  activeRoomId,
  offsets,
  input,
  destination,
  enabled,
  onRoomChange,
}: {
  rooms: GalleryRoom[];
  activeRoomId: string;
  offsets: number[];
  input: React.RefObject<Set<string>>;
  destination: React.RefObject<Vector3 | null>;
  enabled: boolean;
  onRoomChange?: (id: string) => void;
}) {
  const { camera, gl } = useThree();
  const currentRoomIndex = useRef(Math.max(0, rooms.findIndex((room) => room.id === activeRoomId)));
  const handledRoomId = useRef(activeRoomId);
  const initialized = useRef(false);
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());

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
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      gl.domElement.setPointerCapture(pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
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
  }, [camera, enabled, gl, input]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const keys = input.current;
    const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const sideInput = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const destinationPoint = destination.current;
    if (!forwardInput && !sideInput && !destinationPoint) return;

    if (forwardInput || sideInput) {
      destination.current = null;
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
        return;
      }
      direction.current.normalize();
      velocity.current.copy(direction.current);
    }
    velocity.current.multiplyScalar(Math.min(delta, 0.05) * 4);

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
      currentRoomIndex.current = nextIndex;
      handledRoomId.current = rooms[nextIndex].id;
      onRoomChange?.(rooms[nextIndex].id);
      return;
    }
    camera.position.x = MathUtils.clamp(nextX, leftEdge, rightEdge);
  });

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
        onFloorClick?.(point);
      } : undefined}
      leftOpening={walkMode && index > 0 ? "none" : "window"}
      rightOpening={walkMode && index < sceneRooms.length - 1 ? "door" : "window"}
      entrance={walkMode && index === 0}
    />
  ));
  const startRoom = sceneRooms[Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)))];
  const startIndex = Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)));
  const startOffset = offsets[startIndex];
  const startDepth = roomLayouts[startRoom.layout].depth;

  return (
    <div className={`${className ?? "gallery-canvas"}${walkMode && walking ? " is-walking" : ""}`}>
      <Canvas camera={{ position: walkMode ? [startOffset, 1.65, startDepth / 2 - 1.5] : [0, 3.2, 11], fov: walkMode ? 75 : 43 }} dpr={[1, 1.6]} shadows>
        <color attach="background" args={[room.wallColor]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[-3, 8, 4]} intensity={1.8} />
        {sceneRooms.map((sceneRoom, index) => <pointLight key={`light-${sceneRoom.id}`} position={[offsets[index], 4, -2]} intensity={0.55} color="#f4d8b8" />)}
        {artworkNodes}
        {walkMode && input ? (
          <WalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} input={input} destination={destination} enabled={walking ?? false} onRoomChange={onRoomChange} />
        ) : (
          <OrbitControls
            makeDefault
            minDistance={4}
            maxDistance={Math.max(roomLayouts[room.layout].width, roomLayouts[room.layout].depth) + 6}
            maxPolarAngle={Math.PI / 2.03}
            target={[0, 2.1, -roomLayouts[room.layout].depth / 2]}
            enableDamping
          />
        )}
      </Canvas>
    </div>
  );
}

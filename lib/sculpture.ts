// 3D sculptures in exhibitions (GLB).
//
// A sculpture artwork is an Artwork with `sculptureUrl` set (same-origin
// serving URL, /api/sculpture/sculptures/<userId>/<uuid>.glb). `sculptureUrl`
// wins over `imageUrl` and `videoUrl` on the floor: the work renders on
// an automatic white pedestal (~1 m high) instead of hanging on a wall,
// with the GLB normalised to fit on top of it. No separate `mediaKind`
// column — presence of the URL is the kind, so old rows (sculptureUrl
// null) keep rendering exactly as before (same pattern as videoUrl).
//
// Source decision: R2 through the same server proxy as images, music
// and video (/api/uploads/sculpture → sculptures/<userId>/<uuid>.glb,
// served same-origin from /api/sculpture/<key>). GLB only — a .gltf
// file references external buffers/textures by relative path, so it
// cannot survive a single-object upload; GLB is self-contained. 4.5 MB
// cap — the same Vercel request-body cap that binds images, music and
// video, because the bucket has no CORS policy and the browser cannot
// PUT to R2 directly (see lib/r2.ts). A detailed sculpture over 4.5 MB
// needs the presigned direct upload (/api/uploads/presign) once the
// bucket has a CORS policy; that is still blocked (see lib/r2.ts).
// GLBs compress well (Draco / meshopt in Blender or gltfpack), so most
// single sculptures fit: a 1–2 MB GLB is a typical detailed piece.
//
// No external GLB is accepted: a third-party .glb would need CORS
// headers for GLTFLoader's fetch (most hosts do not send them), and
// the serving route's access rule (public show open, otherwise owner
// only) only works for objects SANAA stored itself.
//
// The Image-to-3D tool (components/image-to-3d.tsx) has NO connected
// external provider — its local modes are a 2D texture and a
// depth-from-brightness relief, neither of which produces a GLB — so
// the GLB that lands here comes from the tool's Import tab (the artist
// uploads their own .glb, which is now stored server-side instead of
// only catalogued) or from a direct .glb upload in the editor. A true
// image-to-GLB reconstruction still needs a connected provider (see
// lib/asset-library.ts EXTERNAL_PROVIDER_SLOTS).
export const SCULPTURE_MAX_FILE_SIZE = 4_500_000;
export const SCULPTURE_MIME_TYPES: Record<string, string> = {
  "model/gltf-binary": "glb",
  // Some browsers / OSes report a .glb as application/octet-stream.
  "application/octet-stream": "glb",
};

// Pedestal the gallery builds under every sculpture (metres, in the
// room's own language: the fixed Sunlight pedestals are white boxes,
// #f8f8f6, 0.6–0.9 m wide and 0.9–1.15 m high — see lib/sunlight.ts).
// A user sculpture gets the same treatment: white, 0.6 m square,
// 1.0 m high. The GLB is normalised to fit in the box above it
// (see SCULPTURE_MAX_MODEL_SIZE_M).
export const SCULPTURE_PEDESTAL_WIDTH_M = 0.6;
export const SCULPTURE_PEDESTAL_HEIGHT_M = 1.0;
export const SCULPTURE_PEDESTAL_COLOR = "#f8f8f6";
// Longest side of the normalised model, in metres — a sculpture
// taller than this would dwarf the pedestal and the room.
export const SCULPTURE_MAX_MODEL_SIZE_M = 0.9;
// Half-width of the collision block around a pedestal (pedestal
// half-width + a small margin, so the visitor stops at the plinth
// instead of inside it — the walk test adds its own 0.4 m body).
export const SCULPTURE_COLLISION_HALF_M = 0.35;

// Same-origin serving URL for a stored sculpture, e.g.
// /api/sculpture/sculptures/<userId>/<uuid>.glb — the only shape the
// validator and the serving route accept.
export function isSculptureServingUrl(url: string): boolean {
  return /^\/api\/sculpture\/sculptures\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.glb$/i.test(url);
}

// The R2 object key inside a serving URL, or null when the URL is not
// one. Shared by the validator (client + server) and the serving route.
export function parseSculptureServingUrl(url: string): string | null {
  const match = /^\/api\/sculpture\/(sculptures\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.glb)$/i.exec(url);
  return match ? match[1] : null;
}

export function isSculptureArtwork(artwork: { sculptureUrl?: string | null }): boolean {
  return Boolean(artwork.sculptureUrl);
}

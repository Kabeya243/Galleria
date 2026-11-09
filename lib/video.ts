// Video artworks on gallery walls.
//
// A video artwork is an Artwork with `videoUrl` set (same-origin serving
// URL, /api/video/videos/<userId>/<uuid>.mp4). `videoUrl` wins over
// `imageUrl` on the wall: the image, when present, is only the fallback
// poster. No separate `mediaKind` column — presence of the URL is the
// kind, so old rows (videoUrl null) keep rendering exactly as before.
//
// Source decision: R2. Small clips go through the server proxy
// (/api/uploads/video → videos/<userId>/<uuid>.mp4, served same-origin
// from /api/video/<key>), which is capped at 4.5 MB by Vercel's
// request-body cap; heavier films go straight to R2 with a presigned
// PUT URL (/api/uploads/presign, 200 MB), and the stored URL is the
// same either way. At a gallery-loop bitrate (~1–2 Mbps, 720p) 200 MB
// fits a film of several minutes.
// No external video URL is accepted: a third-party mp4 would need CORS
// headers to load as a WebGL texture (most hosts do not send them), and
// YouTube/Vimeo pages are not video files at all.
//
// Playback decision (performance): a wall video plays ONLY when it is
// near and facing the visitor (within VIDEO_PLAY_DISTANCE_M, in the
// camera's forward half-space) or when it is the selected artwork —
// otherwise it stays paused on its first frame. Distant videos never
// stream: preload="metadata" fetches only the header, play() starts the
// stream. A room full of videos therefore decodes at most the one or
// two the visitor is standing in front of, never the whole room.
// Sound is muted by default (muted autoplay is the only autoplay
// browsers allow); sound turns on only from an explicit visitor gesture
// — the sound button in the artwork detail panel.
export const VIDEO_MAX_FILE_SIZE = 4_500_000;
export const VIDEO_DIRECT_MAX_FILE_SIZE = 200 * 1024 * 1024;
export const VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
};
// How close (metres, world space) the camera must be for a wall video
// to play. The Sunlight room is 22 × 26 m: at 7 m a visitor standing
// in front of one wall cannot also be within range of the opposite
// wall's videos.
export const VIDEO_PLAY_DISTANCE_M = 7;
// Dot product of the camera forward vector and the direction to the
// artwork: > 0 means the artwork is somewhere in front of the camera.
// 0.2 asks for roughly in view, not just behind the visitor's shoulder.
export const VIDEO_PLAY_FACING_DOT = 0.2;

// Same-origin serving URL for a stored video, e.g.
// /api/video/videos/<userId>/<uuid>.mp4 — the only shape the validator
// and the serving route accept.
export function isVideoServingUrl(url: string): boolean {
  return /^\/api\/video\/videos\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.mp4$/i.test(url);
}

// The R2 object key inside a serving URL, or null when the URL is not
// one. Shared by the validator (client + server) and the serving route.
export function parseVideoServingUrl(url: string): string | null {
  const match = /^\/api\/video\/(videos\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.mp4)$/i.exec(url);
  return match ? match[1] : null;
}

export function isVideoArtwork(artwork: { videoUrl?: string | null }): boolean {
  return Boolean(artwork.videoUrl);
}

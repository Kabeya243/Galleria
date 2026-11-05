import type { ElementType } from "@/lib/elements";

// Faithful thumbnails for the Elements palette, the Elements list and the
// inspector: small front-view SVG drawings that actually look like the
// object (same shapes and proportions as the 3D meshes in
// gallery-scene.tsx), not generic icons.
export default function ElementThumbnail({ type, size = 26 }: { type: ElementType; size?: number }) {
  const stroke = "#5c564a";
  const fill = "#f5f2eb";
  const wood = "#8a6a45";
  const glass = "#bcd8de";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {type === "partition" && (
        <>
          <rect x="11" y="4" width="26" height="34" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <rect x="7" y="38" width="34" height="3.5" fill="#d8d2c4" stroke={stroke} strokeWidth="1" />
          <rect x="11" y="41.5" width="4" height="3" fill="#6b675f" />
          <rect x="33" y="41.5" width="4" height="3" fill="#6b675f" />
        </>
      )}
      {type === "chair" && (
        <>
          <rect x="16" y="5" width="16" height="17" rx="1" fill={wood} stroke={stroke} strokeWidth="1.2" />
          <rect x="12" y="24" width="24" height="5" rx="1" fill={wood} stroke={stroke} strokeWidth="1.2" />
          <line x1="14" y1="29" x2="14" y2="44" stroke={stroke} strokeWidth="2" />
          <line x1="34" y1="29" x2="34" y2="44" stroke={stroke} strokeWidth="2" />
        </>
      )}
      {type === "bench" && (
        <>
          <rect x="5" y="24" width="38" height="9" rx="1" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <rect x="9" y="33" width="3.5" height="10" fill="#6b675f" />
          <rect x="35.5" y="33" width="3.5" height="10" fill="#6b675f" />
        </>
      )}
      {type === "table" && (
        <>
          <rect x="5" y="13" width="38" height="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="10" y1="17" x2="10" y2="44" stroke={stroke} strokeWidth="2.5" />
          <line x1="38" y1="17" x2="38" y2="44" stroke={stroke} strokeWidth="2.5" />
        </>
      )}
      {type === "door" && (
        <>
          <rect x="12" y="3" width="24" height="42" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <rect x="16" y="7" width="16" height="34" fill="#e8ddc8" stroke={stroke} strokeWidth="1" />
          <circle cx="28.5" cy="25" r="1.8" fill={stroke} />
        </>
      )}
      {type === "window" && (
        <>
          <rect x="7" y="9" width="34" height="27" fill={glass} fillOpacity="0.55" stroke={stroke} strokeWidth="1.5" />
          <line x1="24" y1="9" x2="24" y2="36" stroke={stroke} strokeWidth="1.2" />
          <line x1="7" y1="22.5" x2="41" y2="22.5" stroke={stroke} strokeWidth="1.2" />
          <rect x="5" y="36" width="38" height="3.5" fill={fill} stroke={stroke} strokeWidth="1.2" />
        </>
      )}
      {type === "wall-text" && (
        <>
          <rect x="7" y="10" width="32" height="5.5" fill="#b3261e" />
          <rect x="7" y="19" width="24" height="5.5" fill="#b3261e" />
          <rect x="7" y="29" width="30" height="2.6" fill="#3a3a36" />
          <rect x="7" y="34" width="22" height="2.6" fill="#3a3a36" />
        </>
      )}
      {type === "plinth" && (
        <>
          <polygon points="15,12 20,7 37,7 32,12" fill="#e8e2d4" stroke={stroke} strokeWidth="1" />
          <rect x="15" y="12" width="17" height="30" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <polygon points="32,12 37,7 37,37 32,42" fill="#ddd5c2" stroke={stroke} strokeWidth="1" />
        </>
      )}
      {type === "vitrine" && (
        <>
          <rect x="13" y="33" width="22" height="9" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <rect x="14.5" y="12" width="19" height="21" fill={glass} fillOpacity="0.5" stroke={stroke} strokeWidth="1.2" />
          <rect x="12" y="9.5" width="24" height="3" fill="#555550" />
        </>
      )}
      {type === "track-light" && (
        <>
          <rect x="5" y="7" width="38" height="3.5" fill="#2b2b28" />
          <circle cx="12" cy="15" r="3.5" fill="#3a3a36" />
          <circle cx="24" cy="15" r="3.5" fill="#3a3a36" />
          <circle cx="36" cy="15" r="3.5" fill="#3a3a36" />
          <polygon points="8,19 16,19 20,30 4,30" fill="#f4d8b8" fillOpacity="0.35" />
          <polygon points="20,19 28,19 32,30 16,30" fill="#f4d8b8" fillOpacity="0.35" />
          <polygon points="32,19 40,19 44,30 28,30" fill="#f4d8b8" fillOpacity="0.35" />
        </>
      )}
      {type === "shelf" && (
        <>
          <line x1="10" y1="10" x2="10" y2="38" stroke={stroke} strokeWidth="1.5" />
          <line x1="38" y1="10" x2="38" y2="38" stroke={stroke} strokeWidth="1.5" />
          <rect x="7" y="15" width="34" height="3" fill={glass} fillOpacity="0.6" stroke={stroke} strokeWidth="1" />
          <rect x="7" y="29" width="34" height="3" fill={glass} fillOpacity="0.6" stroke={stroke} strokeWidth="1" />
        </>
      )}
      {type === "desk" && (
        <>
          <rect x="4" y="17" width="28" height="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="8" y1="21" x2="8" y2="43" stroke={stroke} strokeWidth="2.5" />
          <line x1="28" y1="21" x2="28" y2="43" stroke={stroke} strokeWidth="2.5" />
          <rect x="35" y="21" width="9" height="13" rx="1" fill={wood} stroke={stroke} strokeWidth="1.2" />
          <rect x="33" y="34" width="13" height="3.5" fill={wood} stroke={stroke} strokeWidth="1.2" />
          <line x1="39" y1="37.5" x2="39" y2="43" stroke={stroke} strokeWidth="2" />
        </>
      )}
      {type === "curtain" && (
        <>
          <rect x="5" y="5" width="38" height="3" fill="#555550" />
          <path d="M11 8 C 9 18, 13 28, 11 43" fill="none" stroke="#9db8c0" strokeWidth="1.5" />
          <path d="M18 8 C 16 18, 20 28, 18 43" fill="none" stroke="#9db8c0" strokeWidth="1.5" />
          <path d="M25 8 C 23 18, 27 28, 25 43" fill="none" stroke="#9db8c0" strokeWidth="1.5" />
          <path d="M32 8 C 30 18, 34 28, 32 43" fill="none" stroke="#9db8c0" strokeWidth="1.5" />
          <path d="M39 8 C 37 18, 41 28, 39 43" fill="none" stroke="#9db8c0" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

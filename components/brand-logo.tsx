// Lakisa brand logo (brand kit, public/brand/). The kit ships two
// variants per lockup — Noir (white on near-black) for dark surfaces,
// Blanc (black on white) for light ones. By default the active site
// theme picks which one shows ([data-theme="light"] on <html>); pages
// with a fixed background (the black landing page, the noir auth
// screens) force one variant with `theme` instead.
export type BrandLogoVariant = "horizontal" | "icon" | "principal";

const FILES: Record<BrandLogoVariant, { dark: string; light: string }> = {
  horizontal: {
    dark: "/brand/lakisa-horizontal-noir.svg",
    light: "/brand/lakisa-horizontal-blanc.svg",
  },
  icon: {
    dark: "/brand/lakisa-icon-noir.svg",
    light: "/brand/lakisa-icon-blanc.svg",
  },
  principal: {
    dark: "/brand/lakisa-principal-noir.svg",
    light: "/brand/lakisa-principal-blanc.svg",
  },
};

// Same lockups without the small "& Gallery" line under LAKISA, for
// instances that want the wordmark alone (homepage header, November
// 2026). Only the horizontal lockup has a tagline, so only it ships
// a no-tagline file; other variants fall back to their normal file.
const FILES_NO_TAGLINE: Record<BrandLogoVariant, { dark: string; light: string }> = {
  horizontal: {
    dark: "/brand/lakisa-horizontal-noir-notagline.svg",
    light: "/brand/lakisa-horizontal-blanc-notagline.svg",
  },
  icon: FILES.icon,
  principal: FILES.principal,
};

export default function BrandLogo({
  variant = "horizontal",
  theme = "auto",
  themeScope = "site",
  height,
  tagline = true,
  className = "",
}: {
  variant?: BrandLogoVariant;
  /** "auto" follows the site theme; "dark"/"light" forces one variant. */
  theme?: "auto" | "dark" | "light";
  /** Which theme attribute drives "auto" — the site theme, or the admin panel's own theme. */
  themeScope?: "site" | "admin";
  /** Height in px (overrides the CSS default for the variant). */
  height?: number;
  /** False hides the small "& Gallery" line under LAKISA (horizontal lockup only). Default true. */
  tagline?: boolean;
  className?: string;
}) {
  const files = tagline ? FILES[variant] : FILES_NO_TAGLINE[variant];
  const showDark = theme !== "light";
  const showLight = theme !== "dark";
  return (
    <span
      className={`brand-logo brand-logo-${variant}${theme === "auto" ? " brand-logo-auto" : ""}${theme === "auto" && themeScope === "admin" ? " brand-logo-admin" : ""}${className ? ` ${className}` : ""}`}
      style={height ? { height } : undefined}
    >
      {showDark && <img className="brand-logo-dark" src={files.dark} alt="Lakisa" />}
      {showLight && <img className="brand-logo-light" src={files.light} alt="Lakisa" />}
    </span>
  );
}

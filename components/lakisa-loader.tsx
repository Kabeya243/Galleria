// Animated Lakisa loading mark: the brand kit wireframe cube
// (public/brand/lakisa-icon-*.svg), drawn inline so its strokes can
// animate. The cube draws itself once, then breathes gently while the
// work goes on. The stroke uses currentColor, so the cube follows the
// site theme (white on dark surfaces, black on light ones) with no
// variant prop needed. When a real percent is known (direct R2
// upload progress), it shows below the cube with a thin bar; when it
// is null the animation runs without a number — never a fake percent.
import "./lakisa-loader.css";

export default function LakisaLoader({
  size = "md",
  progress = null,
  label,
  fullscreen = false,
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  /** Real percent (0-100) when the caller has one; null = indeterminate. */
  progress?: number | null;
  label?: string;
  /** Full-screen centered overlay (route loading). */
  fullscreen?: boolean;
  className?: string;
}) {
  const percent = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  const ariaLabel = `${label ?? "Loading"}${percent !== null ? ` ${percent}%` : ""}`;
  return (
    <div
      className={`lakisa-loader lakisa-loader-${size}${fullscreen ? " lakisa-loader-fullscreen" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <svg
        className="lakisa-loader-cube lakisa-loader-breathe"
        viewBox="0 0 460 544"
        aria-hidden="true"
        focusable="false"
      >
        <g transform="translate(230,30)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <polygon className="lakisa-loader-shape" style={{ animationDelay: "0s" }} points="-201,116 0,0 0,279 -201,383" strokeWidth="3.0" pathLength={100} />
          <polygon className="lakisa-loader-shape" style={{ animationDelay: "0.12s" }} points="0,0 201,116 201,383 0,279" strokeWidth="3.0" pathLength={100} />
          <polygon className="lakisa-loader-shape" style={{ animationDelay: "0.24s" }} points="-201,383 0,279 201,383 0,484" strokeWidth="3.0" pathLength={100} />
          <polygon className="lakisa-loader-shape" style={{ animationDelay: "0.36s" }} points="-131,135 -58,93 -58,149 -131,191" strokeWidth="2.5" pathLength={100} />
          <polygon className="lakisa-loader-shape" style={{ animationDelay: "0.44s" }} points="-124,136 -65,102 -65,148 -124,182" strokeWidth="2.5" pathLength={100} />
          <g strokeWidth="2.0">
            <ellipse className="lakisa-loader-shape" style={{ animationDelay: "0.52s" }} cx="-103" cy="137" rx="3" ry="1.8" transform="rotate(-30 -103 137)" pathLength={100} />
            <ellipse className="lakisa-loader-shape" style={{ animationDelay: "0.56s" }} cx="-87" cy="129" rx="3" ry="1.8" transform="rotate(-30 -87 129)" pathLength={100} />
            <path className="lakisa-loader-shape" style={{ animationDelay: "0.6s" }} d="M -94,134 L -96,144 Q -95,147 -92,146" pathLength={100} />
            <path className="lakisa-loader-shape" style={{ animationDelay: "0.64s" }} d="M -100,152 Q -95,155 -90,150" pathLength={100} />
          </g>
        </g>
      </svg>
      {label ? <span className="lakisa-loader-label">{label}</span> : null}
      {percent !== null ? (
        <>
          <span className="lakisa-loader-track" aria-hidden="true">
            <span className="lakisa-loader-fill" style={{ width: `${percent}%` }} />
          </span>
          <span className="lakisa-loader-percent">{percent}%</span>
        </>
      ) : null}
    </div>
  );
}

// Upload progress baked into the button that started the upload: a
// fill that grows behind the label as the real percent climbs, the
// animated cube inside, and the percent next to the label. The button
// itself gets the `lakisa-upload-btn` class (position + clipping).
// When progress is null (small proxy upload, no progress events) the
// cube still animates and no number is faked.
export function LakisaUploadProgress({
  progress = null,
  label,
}: {
  progress?: number | null;
  label?: string;
}) {
  const percent = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <>
      {percent !== null ? (
        <span className="lakisa-upload-btn-fill" aria-hidden="true" style={{ width: `${percent}%` }} />
      ) : null}
      <span className="lakisa-upload-btn-content">
        <LakisaLoader size="xs" />
        {label ? <span>{label}</span> : null}
        {percent !== null ? <span>{percent}%</span> : null}
      </span>
    </>
  );
}

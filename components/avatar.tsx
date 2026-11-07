// Shared avatar: the creator's profile photo when set, otherwise the
// initials fallback that was already used everywhere. The caller supplies
// the sizing/shape class (settings-avatar, profile-avatar, dashboard
// avatar, …) — the photo fills it with object-fit cover and inherits its
// border radius, so every surface keeps its own look.

export default function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (avatarUrl) {
    return (
      <span className={className} style={{ overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }}
        />
      </span>
    );
  }
  return <span className={className}>{initials}</span>;
}

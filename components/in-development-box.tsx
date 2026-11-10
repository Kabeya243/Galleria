// A clearly visible "in development" box, used by the tools that exist
// in the hub but are still being built (Video Generator, Marketplace).
// Same look on tool pages and public pages: the platform accent on the
// left edge, plain words, no em dash.
export default function InDevelopmentBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="note"
      style={{
        marginBottom: 20,
        padding: "16px 18px",
        border: "1px solid var(--line)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: 8,
        background: "var(--room-color, transparent)",
      }}
    >
      <strong style={{ display: "block", fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>
        {title}
      </strong>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>{children}</p>
    </div>
  );
}

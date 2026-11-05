import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import styles from "./tools.module.css";

// One layout for the four audience pages (artists, curators, galleries,
// collectors): what SANAA does for them, in a few plain lines, and where to
// start. The copy is SANAA's own.
export default function AudiencePage({
  user,
  exhibitionCount,
  title,
  eyebrow,
  description,
  points,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  title: string;
  eyebrow: string;
  description: string;
  points: { heading: string; text: string }[];
}) {
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title={title}
      eyebrow={eyebrow}
      description={description}
    >
      <div className={styles.audiencePoints}>
        {points.map((point) => (
          <div key={point.heading}>
            <h3>{point.heading}</h3>
            <p>{point.text}</p>
          </div>
        ))}
      </div>
      <Link href="/tools" className="galleries-open-button">
        See all the tools
      </Link>
    </ToolsShell>
  );
}

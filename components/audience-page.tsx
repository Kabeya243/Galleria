"use client";

import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import { useT, type DictionarySection } from "@/lib/i18n";
import styles from "./tools.module.css";

// One layout for the four audience pages (artists, curators, galleries,
// collectors): what SANAA does for them, in a few plain lines, and where to
// start. The copy is SANAA's own. Title, eyebrow, description and points
// are dictionary keys (lib/i18n.ts, section "toolpages") so the pages
// switch language with the rest of the site.
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
  title: DictionarySection<"toolpages">;
  eyebrow: DictionarySection<"toolpages">;
  description: DictionarySection<"toolpages">;
  points: { heading: DictionarySection<"toolpages">; text: DictionarySection<"toolpages"> }[];
}) {
  const t = useT();
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
            <h3>{t("toolpages", point.heading)}</h3>
            <p>{t("toolpages", point.text)}</p>
          </div>
        ))}
      </div>
      <Link href="/tools" className="galleries-open-button">
        {t("toolpages", "seeAllTools")}
      </Link>
    </ToolsShell>
  );
}

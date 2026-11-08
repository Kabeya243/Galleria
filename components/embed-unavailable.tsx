"use client";

import { translate, useT } from "@/lib/i18n";

// Generic embed error: the exhibition is not public (or does not
// exist), so it cannot be embedded. No title, description or artwork
// is ever shown here. Client component because lib/i18n.ts uses
// useSyncExternalStore and cannot be imported from a server page.
// Both languages are shown so the message reads on any host site,
// whatever the visitor's stored locale is.
export default function EmbedUnavailable() {
  const t = useT();
  return (
    <main className="embed-unavailable">
      <p className="embed-unavailable-brand">SANAA</p>
      <h1>{t("embed", "notAvailable")}</h1>
      <p>{translate("embed", "notAvailableHint", "en")}</p>
      <p lang="fr">{translate("embed", "notAvailableHint", "fr")}</p>
    </main>
  );
}

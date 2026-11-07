// FR/EN interface dictionary for SANAA (November 2026).
//
// Microcopy rules (apply to every string added here):
// - Buttons and actions use the infinitive or the imperative, short.
// - No trailing period on a button label.
// - One idea per string; no marketing adjectives.
// - French first (Kabeya's language), English second.
//
// Usage (client components):
//   import { useT, useLocale, setLocale } from "@/lib/i18n";
//   const t = useT();            // t("entry.enterRoom") -> "Enter the room"
//   const { locale } = useLocale();
// Locale is stored in localStorage ("sanaa-locale") and defaults to the
// browser language (French when it starts with "fr", English otherwise).
// The hook is provider-free: a module-level store + useSyncExternalStore,
// so any client component can use it without wrapping the tree.

import { useSyncExternalStore } from "react";

export type Locale = "fr" | "en";

const STORAGE_KEY = "sanaa-locale";

const listeners = new Set<() => void>();
let currentLocale: Locale = "en";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
    if (window.navigator.language.toLowerCase().startsWith("fr")) return "fr";
  } catch {
    // Storage unavailable — fall through to English.
  }
  return "en";
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale !== "fr" && locale !== "en") return;
  currentLocale = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage unavailable — the choice simply does not persist.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Locale {
  return currentLocale;
}

// Initialise once on the client (avoids a server/client mismatch: the
// server renders English, the client corrects after hydration).
if (typeof window !== "undefined") {
  currentLocale = detectLocale();
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const locale = useSyncExternalStore<Locale>(subscribe, getSnapshot, () => "en");
  return { locale, setLocale };
}

export const DICTIONARY = {
  common: {
    close: { fr: "Fermer", en: "Close" },
    back: { fr: "Retour", en: "Back" },
    cancel: { fr: "Annuler", en: "Cancel" },
    loading: { fr: "Chargement…", en: "Loading…" },
    view: { fr: "Voir", en: "View" },
    save: { fr: "Enregistrer", en: "Save" },
    minutes: { fr: "minutes", en: "minutes" },
    minute: { fr: "minute", en: "minute" },
  },
  artwork: {
    contactArtist: { fr: "Contacter l'artiste", en: "Contact the artist" },
    zoomIn: { fr: "Zoomer", en: "Zoom in" },
    zoomOut: { fr: "Dézoomer", en: "Zoom out" },
    viewFullSize: { fr: "Voir en plein écran", en: "View full size" },
    artwork: { fr: "Œuvre", en: "Artwork" },
    artist: { fr: "Artiste", en: "Artist" },
    year: { fr: "Année", en: "Year" },
    medium: { fr: "Technique", en: "Medium" },
    dimensions: { fr: "Dimensions", en: "Dimensions" },
    description: { fr: "Description", en: "Description" },
    sendMessage: { fr: "Envoyer le message", en: "Send message" },
    yourName: { fr: "Votre nom", en: "Your name" },
    yourEmail: { fr: "Votre e-mail", en: "Your email" },
    yourMessage: { fr: "Votre message", en: "Your message" },
    messageSent: { fr: "Message envoyé", en: "Message sent" },
    messageSentDetail: {
      fr: "L'artiste lira votre message et vous répondra à cette adresse.",
      en: "The artist will read your message and reply to this address.",
    },
    writeToArtist: { fr: "Écrire à l'artiste", en: "Write to the artist" },
  },
  minimap: {
    floorPlan: { fr: "Plan des salles", en: "Floor plan" },
    goToArtwork: { fr: "Aller à l'œuvre", en: "Go to artwork" },
    room: { fr: "Salle", en: "Room" },
    youAreHere: { fr: "Vous êtes ici", en: "You are here" },
  },
  listView: {
    listView: { fr: "Vue liste", en: "List view" },
    view3d: { fr: "Vue 3D", en: "3D view" },
    viewIn3d: { fr: "Voir en 3D", en: "View in 3D" },
    artworks: { fr: "œuvres", en: "artworks" },
    noArtworks: { fr: "Aucune œuvre dans cette exposition", en: "No artworks in this exhibition" },
    allArtworks: { fr: "Toutes les œuvres", en: "All artworks" },
    lowBandwidthNote: {
      fr: "Version légère, sans 3D — idéale sur une petite connexion.",
      en: "Light version, no 3D — best on a slow connection.",
    },
  },
  entry: {
    enterRoom: { fr: "Entrer dans la salle", en: "Enter the room" },
    walkThrough: { fr: "Visiter l'exposition", en: "Walk through the exhibition" },
    estimatedVisit: { fr: "Durée estimée", en: "Estimated visit" },
    controls: { fr: "Commandes", en: "Controls" },
    keyboard: { fr: "Clavier", en: "Keyboard" },
    mouse: { fr: "Souris", en: "Mouse" },
    touch: { fr: "Tactile", en: "Touch" },
    moveKeys: { fr: "ZQSD ou flèches pour marcher", en: "WASD or arrow keys to walk" },
    dragLook: { fr: "Glisser pour regarder autour", en: "Drag to look around" },
    touchPad: { fr: "Pavé tactile pour marcher", en: "Touch pad to walk" },
    clickFloor: { fr: "Cliquer sur le sol pour s'y rendre", en: "Click the floor to walk there" },
    clickArtwork: { fr: "Cliquer sur une œuvre pour la voir", en: "Click an artwork to view it" },
    sound: { fr: "Son", en: "Sound" },
    soundOn: { fr: "Son activé", en: "Sound on" },
    soundOff: { fr: "Son coupé", en: "Sound off" },
    soundNote: {
      fr: "Active les descriptions audio quand elles existent.",
      en: "Turns on audio descriptions when they exist.",
    },
    quality: { fr: "Qualité", en: "Quality" },
    qualityRecommended: { fr: "Recommandé", en: "Recommended" },
    qualityHigh: { fr: "Haute", en: "High" },
    qualityMedium: { fr: "Moyenne", en: "Medium" },
    qualityLow: { fr: "Basse", en: "Low" },
    qualityNote: {
      fr: "Choisi selon votre appareil — changeable à tout moment.",
      en: "Picked for your device — changeable at any time.",
    },
  },
  share: {
    share: { fr: "Partager", en: "Share" },
    copyLink: { fr: "Copier le lien", en: "Copy link" },
    linkCopied: { fr: "Lien copié", en: "Link copied" },
    scanToOpen: { fr: "Scanner pour ouvrir", en: "Scan to open" },
    shareExhibition: { fr: "Partager cette exposition", en: "Share this exhibition" },
  },
  stats: {
    visitorStats: { fr: "Statistiques des visiteurs", en: "Visitor statistics" },
    visits: { fr: "Visites", en: "Visits" },
    avgVisitTime: { fr: "Temps moyen", en: "Average time" },
    topArtworks: { fr: "Œuvres les plus vues", en: "Most viewed artworks" },
    countries: { fr: "Pays des visiteurs", en: "Visitor countries" },
    noVisitsYet: { fr: "Aucune visite pour l'instant", en: "No visits yet" },
    views: { fr: "vues", en: "views" },
    seeFullStats: { fr: "Voir les statistiques complètes", en: "See full statistics" },
  },
  create: {
    createExhibition: { fr: "Créer une exposition", en: "Create an exhibition" },
    exhibitionTitle: { fr: "Titre de l'exposition", en: "Exhibition title" },
    titlePlaceholder: { fr: "Nom de votre exposition", en: "Name your exhibition" },
    titleRequired: { fr: "Un titre est obligatoire", en: "A title is required" },
    chooseModel: { fr: "Choisir un modèle de salle", en: "Choose a room model" },
    modelSunlight: { fr: "Sunlight", en: "Sunlight" },
    modelSunlightDesc: {
      fr: "Grande salle lumineuse sous sept verrières — lumière du jour, sol béton, panneaux autoportants.",
      en: "Bright hall under seven skylights — daylight, concrete floor, freestanding panels.",
    },
    modelSerpentine: { fr: "La Serpentine", en: "La Serpentine" },
    modelSerpentineDesc: {
      fr: "Foire en plein air — quatre murs blancs serpentins sous le ciel, photos sur les deux faces, place en pierre et moquette grise.",
      en: "An open-air art fair — four curved white serpentine walls under the sky, photographs on both faces, a stone plaza and a grey carpet.",
    },
    modelVitrine: { fr: "La Vitrine", en: "La Vitrine" },
    modelVitrineDesc: {
      fr: "Galerie à façade vitrée — façade brique avec son enseigne « exhibit », devanture vitrée, sol béton, socles et étagères.",
      en: "A bright glass-front gallery — a brick facade with its “exhibit” sign, a glazed front, a concrete floor, pedestals and shelves.",
    },
    modelLoft: { fr: "Le Loft Béton", en: "Le Loft Béton" },
    modelLoftDesc: {
      fr: "Loft sombre en béton — poutres, rails et spots, couleurs franches sur murs blancs, cloison et banc.",
      en: "A dark concrete loft — beams, rails and spotlights, bold colour on white walls, a partition and a bench.",
    },
    modelHalle: { fr: "La Halle Design", en: "La Halle Design" },
    modelHalleDesc: {
      fr: "Grande halle design 25 × 34 m — paravents pliants en zigzag, plateformes et mobilier lounge, mobile suspendu à facettes et cerfs-volants.",
      en: "A 25 × 34 m design hall — zigzag folding screens, platforms and lounge furniture, a hanging faceted mobile and kites.",
    },
    modelArche: { fr: "L'Arche", en: "L'Arche" },
    modelArcheDesc: {
      fr: "Galerie en pierre — mur de séparation à arche ronde, niche, gravats et poutres en bois. La Galerie en Pierre d'origine.",
      en: "A stone gallery — a round-arch dividing wall, a niche, rubble and timber beams. The original Stone Gallery.",
    },
    modelMusee: { fr: "Le Musée Bleu", en: "Le Musée Bleu" },
    modelMuseeDesc: {
      fr: "Salle de musée — mur bleu courbe, verrière en caissons, parquet chevrons et panneaux inclinés.",
      en: "A museum room — a curved blue wall, a coffered skylight, herringbone parquet and angled panels.",
    },
    modelClaireVoie: { fr: "La Claire-Voie", en: "La Claire-Voie" },
    modelClaireVoieDesc: {
      fr: "Galerie au sol sombre — immense peinture folk, mur de vinyle texte, bancs blancs et haute fenêtre claire-voie.",
      en: "A dark-floored gallery — a huge folk painting, a wall of text vinyl, white benches and a high clerestory window.",
    },
    modelParquet: { fr: "Le Parquet", en: "Le Parquet" },
    modelParquetDesc: {
      fr: "Salle au parquet chevrons — cloisons en V, socles avec sculptures, mobile debout et accrochage salon.",
      en: "A herringbone-parquet room — V-shaped partitions, pedestals with sculptures, a standing mobile and a salon hang.",
    },
    modelVerriere: { fr: "La Verrière", en: "La Verrière" },
    modelVerriereDesc: {
      fr: "Grande halle 40 × 32 m sous plafond à caissons et verrières — cinq panneaux inclinés avec peintures, banc et pupitre d'étiquette.",
      en: "A 40 × 32 m hall under a coffered skylight ceiling — five angled panels with paintings, a bench and a label stand.",
    },
    modelPavillon: { fr: "Pavillon de lumière", en: "Pavillon de lumière" },
    modelPavillonDesc: {
      fr: "Pavillon lumineux — sol bois, murs en briques de verre, deux salles latérales, palmiers et pelouse dehors.",
      en: "A light pavilion — wood floor, glass-brick walls, two side rooms, palm trees and a lawn outside.",
    },
    modelClassique: { fr: "Galerie classique", en: "Galerie classique" },
    modelClassiqueDesc: {
      fr: "Galerie classique — salle 8 × 40 m sous voûte à caissons, colonnes de granit, verrières dans la voûte.",
      en: "A classical gallery — an 8 × 40 m hall under a coffered vault, granite columns, skylights in the vault.",
    },
    modelAtriumBlanc: { fr: "Atrium blanc", en: "Atrium blanc" },
    modelAtriumBlancDesc: {
      fr: "Atrium blanc — sol laqué marbre, quatre colonnes, tambour noir suspendu au plafond.",
      en: "A white atrium — lacquered marble floor, four columns, a black drum suspended from the ceiling.",
    },
    modelPatio: { fr: "Patio ovale", en: "Patio ovale" },
    modelPatioDesc: {
      fr: "Patio ovale — place de marbre sous une toiture percée d'un ovale, arbres, gravier noir et pelouse.",
      en: "An oval patio — a marble plaza under a roof pierced by an oval opening, trees, black gravel and a lawn.",
    },
    modelEscalier: { fr: "Hall à escalier", en: "Hall à escalier" },
    modelEscalierDesc: {
      fr: "Hall à escalier — 16 × 20 m, escalier de 14 marches, colonne centrale, mezzanine et verre.",
      en: "A stair hall — 16 × 20 m, a 14-step staircase, a central column, a mezzanine and glass.",
    },
    modelSallesVertes: { fr: "Salles vertes", en: "Salles vertes" },
    modelSallesVertesDesc: {
      fr: "Salles vertes — hall 14 × 32 m, murs verts, parquet bois, voûte, trois panneaux, deux bancs et verrière.",
      en: "Green rooms — a 14 × 32 m hall, green walls, wood floor, a vault, three panels, two benches and a skylight.",
    },
    modelCouloirSombre: { fr: "Couloir sombre", en: "Couloir sombre" },
    modelCouloirSombreDesc: {
      fr: "Couloir sombre — hall 7 × 46 m, parquet chevrons, voûte, six panneaux, arches et rails de spots.",
      en: "A dark corridor — a 7 × 46 m hall, herringbone parquet, a vault, six panels, arches and track lights.",
    },
    modelCouloirDore: { fr: "Couloir doré", en: "Couloir doré" },
    modelCouloirDoreDesc: {
      fr: "Couloir doré — hall 7 × 46 m, parquet chevrons, fenêtres en arche lumineuses, mur rouge au fond et taches de soleil au sol.",
      en: "A golden corridor — a 7 × 46 m hall, herringbone parquet, luminous arched windows, a red end wall and sun patches on the floor.",
    },
    modelVoutes: { fr: "Plafond à voûtes", en: "Plafond à voûtes" },
    modelVoutesDesc: {
      fr: "Plafond à voûtes — hall 10 × 30 m, parquet bois, plafond à écailles, deux panneaux et deux bancs.",
      en: "A vaulted ceiling — a 10 × 30 m hall, wood floor, a scale-pattern ceiling, two panels and two benches.",
    },
    modelCourbes: { fr: "Courbes blanches", en: "Courbes blanches" },
    modelCourbesDesc: {
      fr: "Courbes blanches — galerie circulaire, mur courbe blanc, section vitrée, palmiers et pelouse dehors.",
      en: "White curves — a circular gallery, a curved white wall, a glazed section, palm trees and a lawn outside.",
    },
    modelAtriumLattes: { fr: "Atrium à lattes", en: "Atrium à lattes" },
    modelAtriumLattesDesc: {
      fr: "Atrium à lattes — 14 × 18 m, murs à lattes, parquet bois, grande fenêtre sur l'extérieur, mezzanine et escaliers.",
      en: "A slatted atrium — 14 × 18 m, slatted walls, wood floor, a large window onto the outside, a mezzanine and staircases.",
    },
    create: { fr: "Créer", en: "Create" },
    creating: { fr: "Création…", en: "Creating…" },
  },
  publish: {
    visibility: { fr: "Visibilité", en: "Visibility" },
    visibilityPublic: { fr: "Publique", en: "Public" },
    visibilityPublicDesc: { fr: "Listée sur SANAA, ouverte à tous.", en: "Listed on SANAA, open to everyone." },
    visibilityPrivateLink: { fr: "Lien privé", en: "Private link" },
    visibilityPrivateLinkDesc: {
      fr: "Non listée — seul le lien direct ouvre l'exposition.",
      en: "Not listed — only the direct link opens it.",
    },
    visibilityPassword: { fr: "Mot de passe", en: "Password" },
    visibilityPasswordDesc: {
      fr: "Un mot de passe est demandé avant d'entrer.",
      en: "A password is asked before entering.",
    },
    accessPassword: { fr: "Mot de passe d'accès", en: "Access password" },
    accessPasswordPlaceholder: { fr: "Au moins 8 caractères", en: "At least 8 characters" },
    publish: { fr: "Publier", en: "Publish" },
    unpublish: { fr: "Dépublier", en: "Unpublish" },
    enterPassword: { fr: "Entrer le mot de passe", en: "Enter the password" },
    passwordProtected: { fr: "Exposition protégée", en: "Protected exhibition" },
    passwordProtectedDesc: {
      fr: "Cette exposition demande un mot de passe pour entrer.",
      en: "This exhibition needs a password to enter.",
    },
    wrongPassword: { fr: "Mot de passe incorrect", en: "Incorrect password" },
  },
  auth: {
    continueWithGoogle: { fr: "Continuer avec Google", en: "Continue with Google" },
    orContinueWith: { fr: "ou continuer avec", en: "or continue with" },
    passwordRules: { fr: "Votre mot de passe doit contenir", en: "Your password must contain" },
    ruleLength: { fr: "Au moins 10 caractères", en: "At least 10 characters" },
    ruleLower: { fr: "Une minuscule", en: "A lowercase letter" },
    ruleUpper: { fr: "Une majuscule", en: "An uppercase letter" },
    ruleNumber: { fr: "Un chiffre", en: "A number" },
    googleNotConfigured: {
      fr: "La connexion Google n'est pas encore configurée.",
      en: "Google sign-in is not configured yet.",
    },
  },
} as const;

export type DictionaryKey = keyof typeof DICTIONARY;
export type DictionarySection<K extends DictionaryKey> = keyof (typeof DICTIONARY)[K];

/** Translate a dictionary key for the given locale (defaults to current). */
export function translate<K extends DictionaryKey>(
  section: K,
  key: DictionarySection<K>,
  locale: Locale = currentLocale,
): string {
  const entry = (DICTIONARY[section] as Record<string, { fr: string; en: string }>)[key as string];
  return entry?.[locale] ?? entry?.en ?? String(key);
}

/** Hook: a bound translate function for the current locale. */
export function useT(): <K extends DictionaryKey>(section: K, key: DictionarySection<K>) => string {
  const { locale } = useLocale();
  return (section, key) => translate(section, key, locale);
}

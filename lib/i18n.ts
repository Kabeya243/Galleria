// FR/EN interface dictionary for SANAA (November 2026).
//
// Microcopy rules (apply to every string added here):
// - Buttons and actions use the infinitive or the imperative, short.
// - No trailing period on a button label.
// - One idea per string; no marketing adjectives.
// - English first (the site's default language), French second.
//
// Usage (client components):
//   import { useT, useLocale, setLocale } from "@/lib/i18n";
//   const t = useT();            // t("entry.enterRoom") -> "Enter the room"
//   const { locale } = useLocale();
// Locale is stored in localStorage ("sanaa-locale") and defaults to
// English; the visitor switches to French in Settings (or with the
// language switch on the public exhibition page). The hook is
// provider-free: a module-level store + useSyncExternalStore, so any
// client component can use it without wrapping the tree. To add a
// language later, extend `Locale`, the dictionary entries and the
// switcher — every string goes through this file.

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
  } catch {
    // Storage unavailable — fall through to English.
  }
  // English is the default for every visitor; French is opt-in.
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
    saving: { fr: "Enregistrement…", en: "Saving…" },
    saved: { fr: "Enregistré.", en: "Saved." },
    dismiss: { fr: "Ignorer", en: "Dismiss" },
    search: { fr: "Rechercher", en: "Search" },
    signOut: { fr: "Se déconnecter", en: "Sign out" },
    workspace: { fr: "Espace de travail", en: "Workspace" },
    tools: { fr: "Ressources", en: "Resources" },
    open: { fr: "Ouvrir", en: "Open" },
    visit: { fr: "Visiter", en: "Visit" },
    minutes: { fr: "minutes", en: "minutes" },
    minute: { fr: "minute", en: "minute" },
    footerRights: { fr: "© 2026 Lakisa Studio", en: "© 2026 Lakisa Studio" },
    footerTagline: { fr: "Fait pour l'art, fait pour tous.", en: "Made for art, made for everyone." },
    yourWorkspace: { fr: "VOTRE ESPACE DE TRAVAIL", en: "YOUR WORKSPACE" },
  },
  // Sidebar navigation — group headings and items.
  nav: {
    discover: { fr: "Découvrir", en: "Discover" },
    create: { fr: "Créer", en: "Create" },
    spatialLab: { fr: "Spatial Lab", en: "Spatial Lab" },
    manage: { fr: "Gérer", en: "Manage" },
    publish: { fr: "Publier", en: "Publish" },
    intelligence: { fr: "Intelligence", en: "Intelligence" },
    studio: { fr: "Mon studio", en: "My Studio" },
    explore: { fr: "Explorer les expositions", en: "Explore exhibitions" },
    feed: { fr: "Fil", en: "Feed" },
    templates: { fr: "Lakisa Galerie", en: "Lakisa Galerie" },
    home: { fr: "Accueil", en: "Home" },
    exhibitions: { fr: "Mes expositions", en: "My exhibitions" },
    myArtworks: { fr: "Mes œuvres", en: "My artworks" },
    tools: { fr: "Ressources", en: "Resources" },
    price: { fr: "Tarifer mon travail", en: "Price your work" },
    editor: { fr: "Éditeur 3D", en: "3D editor" },
    inventory: { fr: "Inventaire", en: "Inventory" },
    contacts: { fr: "Contacts", en: "Contacts" },
    certificates: { fr: "Certificats", en: "Certificates" },
    adminStats: { fr: "Statistiques admin", en: "Admin stats" },
    presentSell: { fr: "Présenter et vendre", en: "Present & Sell" },
    published: { fr: "Expositions publiées", en: "Published exhibitions" },
    insights: { fr: "Aperçus des expositions", en: "Exhibition insights" },
    adminAnalytics: { fr: "Analytique admin", en: "Admin analytics" },
    dashboard: { fr: "Tableau de bord", en: "Dashboard" },
    settings: { fr: "Paramètres", en: "Settings" },
    signOut: { fr: "Se déconnecter", en: "Sign out" },
    openNav: { fr: "Ouvrir la navigation", en: "Open navigation" },
    closeNav: { fr: "Fermer la navigation", en: "Close navigation" },
    expandNav: { fr: "Déplier le menu", en: "Expand the menu" },
    collapseNav: { fr: "Replier le menu", en: "Collapse the menu" },
    mainNav: { fr: "Navigation principale", en: "Main navigation" },
    sanaaHome: { fr: "Accueil Lakisa", en: "Lakisa home" },
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
  tour: {
    guidedTour: { fr: "Visite guidée", en: "Guided tour" },
    startTour: { fr: "Suivre la visite guidée", en: "Start the guided tour" },
    exitTour: { fr: "Quitter la visite", en: "Exit the tour" },
    previousStop: { fr: "Arrêt précédent", en: "Previous stop" },
    nextStop: { fr: "Arrêt suivant", en: "Next stop" },
    finishTour: { fr: "Terminer la visite", en: "Finish the tour" },
    stop: { fr: "Arrêt", en: "Stop" },
    stopTitle: { fr: "Titre de l'arrêt", en: "Stop title" },
    stopText: { fr: "Texte de l'arrêt", en: "Stop text" },
    stopTitlePlaceholder: { fr: "Titre de cet arrêt", en: "Title for this stop" },
    stopTextPlaceholder: { fr: "Ce que les visiteurs lisent à cet arrêt…", en: "What visitors read at this stop…" },
    enableTour: { fr: "Proposer une visite guidée dans cette exposition", en: "Offer a guided tour in this exhibition" },
    tourHint: {
      fr: "Les visiteurs suivent vos arrêts dans l'ordre, à leur rythme. Chaque arrêt les place devant un point de vue, avec votre texte.",
      en: "Visitors follow your stops in order, at their own pace. Each stop places them at a viewpoint, with your text.",
    },
    addStop: { fr: "Ajouter un arrêt depuis ce point de vue", en: "Add a stop from this viewpoint" },
    addStopHint: {
      fr: "Placez-vous devant une œuvre, puis ajoutez un arrêt : il garde votre position et votre regard.",
      en: "Stand in front of a work, then add a stop: it keeps your position and your gaze.",
    },
    noStops: {
      fr: "Aucun arrêt pour l'instant — placez-vous devant une œuvre, puis ajoutez un arrêt.",
      en: "No stops yet — stand in front of a work, then add a stop.",
    },
    noCamera: {
      fr: "La vue 3D n'est pas prête — attendez un instant, puis réessayez.",
      en: "The 3D view is not ready yet — wait a moment, then try again.",
    },
    roomRemoved: { fr: "Salle supprimée", en: "Room removed" },
    moveUp: { fr: "Monter cet arrêt", en: "Move this stop up" },
    moveDown: { fr: "Descendre cet arrêt", en: "Move this stop down" },
    removeStop: { fr: "Supprimer cet arrêt", en: "Remove this stop" },
    tourSavedNote: {
      fr: "Le parcours est enregistré avec l'exposition quand vous sauvegardez.",
      en: "The tour is saved with the exhibition when you save.",
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
    music: { fr: "Musique", en: "Music" },
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
  vr: {
    enterVR: { fr: "Entrer en VR", en: "Enter VR" },
    exitVR: { fr: "Quitter la VR", en: "Exit VR" },
    checking: { fr: "Vérification de la VR…", en: "Checking VR support…" },
    inSession: {
      fr: "Vous êtes en VR. Joystick pour marcher, bouton principal pour vous téléporter de 2 m. Quittez avec le bouton système du casque.",
      en: "You are in VR. Thumbstick to walk, primary button to teleport 2 m ahead. Exit with the headset's system button.",
    },
    ended: {
      fr: "Session VR terminée. Vous êtes de retour dans la visite normale, au même endroit.",
      en: "VR session ended. You are back in the normal visit, at the same spot.",
    },
    notSupported: {
      fr: "La VR n'est pas disponible sur cet appareil ou navigateur.",
      en: "VR is not available on this device or browser.",
    },
    notSupportedHint: {
      fr: "La VR n'est pas disponible sur cet appareil ou navigateur. Pour essayer la VR, ouvrez cette exposition dans le navigateur d'un casque (par ex. Meta Quest) ou un autre navigateur compatible WebXR.",
      en: "VR is not available on this device or browser. To try VR, open this exhibition in a headset browser (e.g. Meta Quest) or another WebXR-capable browser.",
    },
    viewLoading: {
      fr: "La vue 3D charge encore — attendez un instant et réessayez.",
      en: "The 3D view is still loading — wait a moment and try again.",
    },
    denied: {
      fr: "La session VR n'a pas pu démarrer : autorisation refusée ou casque indisponible.",
      en: "The VR session could not start: permission denied or headset unavailable.",
    },
    failed: {
      fr: "La session VR n'a pas pu démarrer sur cet appareil.",
      en: "The VR session could not start on this device.",
    },
  },
  ar: {
  viewOnMyWall: { fr: "Voir sur mon mur", en: "See it on my wall" },
  checking: { fr: "Vérification de la RA…", en: "Checking AR support…" },
  notSupported: {
    fr: "La RA n'est pas disponible sur cet appareil ou navigateur.",
    en: "AR is not available on this device or browser.",
  },
  notSupportedHint: {
    fr: "Pour voir l'œuvre sur votre mur, ouvrez cette exposition sur un téléphone Android récent avec ARCore, dans Chrome. Sur iPhone, Safari ne prend pas en charge la RA WebXR : aucune prévisualisation RA n'est possible pour l'instant.",
    en: "To see the work on your wall, open this exhibition on a recent Android phone with ARCore, in Chrome. On iPhone, Safari does not support WebXR AR, so no AR preview is possible for now.",
  },
  denied: {
    fr: "La session RA n'a pas pu démarrer : autorisation refusée ou appareil indisponible.",
    en: "The AR session could not start: permission denied or device unavailable.",
  },
  noHitTest: {
    fr: "Cet appareil ne propose pas de détection de surface (hit-test) : aucun mur ne peut être détecté.",
    en: "This device offers no surface detection (hit-test), so no wall can be found.",
  },
  failed: {
    fr: "La session RA n'a pas pu démarrer sur cet appareil.",
    en: "The AR session could not start on this device.",
  },
  requesting: { fr: "Demande de session RA…", en: "Requesting an AR session…" },
  viewLoading: {
    fr: "La vue RA charge encore — attendez un instant et réessayez.",
    en: "The AR view is still loading — wait a moment and try again.",
  },
  pointAtWall: {
    fr: "Pointez votre téléphone vers un mur jusqu'à ce que l'anneau doré apparaisse, puis touchez l'écran pour accrocher l'œuvre à taille réelle, à hauteur d'œil.",
    en: "Point your phone at a wall until the gold ring appears, then tap the screen to hang the work at its real size, at eye level.",
  },
  wallFound: {
    fr: "Mur détecté — touchez l'écran pour accrocher l'œuvre.",
    en: "Wall found — tap the screen to hang the work.",
  },
  floorFound: {
    fr: "Ceci ressemble à un sol — visez un mur vertical.",
    en: "That looks like a floor — aim at a vertical wall.",
  },
  noWallYet: {
    fr: "Aucun mur détecté pour l'instant. Avancez lentement en visant le mur, ou placez l'œuvre à distance fixe.",
    en: "No wall found yet. Move slowly while aiming at the wall, or place the work at a fixed distance.",
  },
  placeAtFixedDistance: { fr: "Placer à distance fixe", en: "Place at a fixed distance" },
  fixedPlaced: {
    fr: "Placée à 1,50 m devant vous, à taille réelle — touchez « Valider » ou déplacez-vous pour repositionner.",
    en: "Placed 1.50 m in front of you, at real size — tap “Confirm” or move to reposition.",
  },
  placed: {
    fr: "Accrochée au mur à taille réelle, centre à 1,50 m du sol.",
    en: "Hung on the wall at real size, centre 1.50 m from the floor.",
  },
  confirmPlacement: { fr: "Valider ce placement", en: "Confirm this placement" },
  reposition: { fr: "Repositionner", en: "Reposition" },
  exitAR: { fr: "Quitter la RA", en: "Exit AR" },
  inSession: {
    fr: "Vous êtes en RA. Quittez avec le bouton ci-dessous ou le bouton système de votre téléphone.",
    en: "You are in AR. Exit with the button below or your phone's system button.",
  },
  ended: {
    fr: "Session RA terminée. Vous êtes de retour dans la visite.",
    en: "AR session ended. You are back in the visit.",
  },
  realSizeNote: {
    fr: "Taille réelle, centre à 1,50 m du sol.",
    en: "Real size, centre 1.50 m from the floor.",
  },
  },
  music: {
    music: { fr: "Musique", en: "Music" },
    playMusic: { fr: "Jouer la musique", en: "Play music" },
    pauseMusic: { fr: "Mettre la musique en pause", en: "Pause music" },
    musicVolume: { fr: "Volume de la musique", en: "Music volume" },
    muteMusic: { fr: "Couper la musique", en: "Mute music" },
    unmuteMusic: { fr: "Remettre la musique", en: "Unmute music" },
    uploadMusic: { fr: "Ajouter une musique", en: "Add music" },
    musicTitle: { fr: "Titre du morceau", en: "Track title" },
    musicTitlePlaceholder: { fr: "Nom du morceau, tel que les visiteurs le verront", en: "Track name, as visitors will see it" },
    loop: { fr: "Jouer en boucle", en: "Loop" },
    removeMusic: { fr: "Retirer la musique", en: "Remove music" },
    musicHint: {
      fr: "MP3 ou AAC (.m4a), 4,5 Mo maximum — un morceau court, en boucle. Pensez à 128 kbps pour un morceau de quelques minutes.",
      en: "MP3 or AAC (.m4a), 4.5 MB maximum — a short track, on loop. Export at 128 kbps for a track a few minutes long.",
    },
    onlyOwnMusic: {
      fr: "Only upload music you own or that is free to share.",
      en: "Only upload music you own or that is free to share.",
    },
    musicTooLarge: {
      fr: "Ce fichier audio est trop lourd (plus de 4,5 Mo). Essayez un morceau plus court, ou exportez-le à 128 kbps.",
      en: "This audio file is too large (over 4.5 MB). Try a shorter track, or export it at 128 kbps.",
    },
    musicInvalidFormat: {
      fr: "Ajoutez un fichier audio MP3 ou AAC (.m4a).",
      en: "Upload an MP3 or AAC (.m4a) audio file.",
    },
    musicUploadFailed: {
      fr: "La musique n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
      en: "Could not upload this music. Check your connection and try again.",
    },
    musicUploading: { fr: "Envoi de la musique…", en: "Uploading music…" },
    musicPreview: { fr: "Écouter avant de publier", en: "Listen before publishing" },
    musicRemovedNote: {
      fr: "Retirer le morceau le retire de l'exposition, pas du stockage — le fichier reste conservé.",
      en: "Removing the track takes it out of the exhibition, not out of storage — the file stays kept.",
    },
  },
  video: {
    video: { fr: "Vidéo", en: "Video" },
    videoArtwork: { fr: "Œuvre vidéo", en: "Video artwork" },
    addVideo: { fr: "Ajouter une vidéo", en: "Add a video" },
    videoHint: {
      fr: "MP4 (H.264), 4,5 Mo maximum — un clip court, en boucle. Exportez en 720p pour une vingtaine de secondes.",
      en: "MP4 (H.264), 4.5 MB maximum — a short clip, on loop. Export at 720p for about twenty seconds.",
    },
    onlyOwnVideo: {
      fr: "Only upload video you own or that is free to share.",
      en: "Only upload video you own or that is free to share.",
    },
    videoTooLarge: {
      fr: "Cette vidéo est trop lourde (plus de 4,5 Mo). Essayez un clip plus court, ou exportez-le en 720p avec un débit plus bas.",
      en: "This video is too large (over 4.5 MB). Try a shorter clip, or export it at 720p with a lower bitrate.",
    },
    videoInvalidFormat: {
      fr: "Ajoutez une vidéo MP4 (H.264).",
      en: "Upload an MP4 (H.264) video file.",
    },
    videoUploadFailed: {
      fr: "La vidéo n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
      en: "Could not upload this video. Check your connection and try again.",
    },
    videoUploading: { fr: "Envoi de la vidéo…", en: "Uploading video…" },
    playVideo: { fr: "Lire la vidéo", en: "Play video" },
    pauseVideo: { fr: "Mettre la vidéo en pause", en: "Pause video" },
    turnSoundOn: { fr: "Activer le son", en: "Turn sound on" },
    turnSoundOff: { fr: "Couper le son", en: "Turn sound off" },
    soundMutedNote: {
      fr: "Son coupé par défaut — activez-le si vous voulez entendre la vidéo.",
      en: "Sound off by default — turn it on if you want to hear the video.",
    },
    replaceVideo: { fr: "Remplacer la vidéo", en: "Replace video" },
    removeVideo: { fr: "Retirer la vidéo", en: "Remove video" },
    videoPlaysMuted: {
      fr: "La vidéo se lit en boucle, sans son, quand vous êtes devant elle.",
      en: "The video loops, muted, when you stand in front of it.",
    },
  },
  sculpture: {
    sculpture: { fr: "Sculpture", en: "Sculpture" },
    sculptureArtwork: { fr: "Sculpture 3D", en: "3D sculpture" },
    addSculpture: { fr: "Ajouter une sculpture", en: "Add a sculpture" },
    sculptureHint: {
      fr: "Fichier .glb uniquement, 4,5 Mo maximum — la sculpture est posée sur un socle blanc automatique, au sol. Exportez en .glb depuis Blender (un .gltf ne peut pas être conservé seul).",
      en: "GLB file only, 4.5 MB maximum — the sculpture stands on an automatic white pedestal, on the floor. Export as .glb from Blender (a .gltf cannot be stored on its own).",
    },
    onlyOwnSculpture: {
      fr: "Only upload sculpture you own or that is free to share.",
      en: "Only upload sculpture you own or that is free to share.",
    },
    sculptureTooLarge: {
      fr: "Cette sculpture est trop lourde (plus de 4,5 Mo). Essayez de la compresser (Draco ou meshopt dans Blender, ou gltfpack) ou un modèle plus simple.",
      en: "This sculpture is too large (over 4.5 MB). Try compressing it (Draco or meshopt in Blender, or gltfpack) or a simpler model.",
    },
    sculptureInvalidFormat: {
      fr: "Ajoutez un fichier .glb. Un .gltf ne peut pas être conservé seul — réexportez-le en .glb dans Blender.",
      en: "Upload a .glb file. A .gltf cannot be stored on its own — re-export it as .glb in Blender.",
    },
    sculptureUploadFailed: {
      fr: "La sculpture n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
      en: "Could not upload this sculpture. Check your connection and try again.",
    },
    sculptureUploading: { fr: "Envoi de la sculpture…", en: "Uploading sculpture…" },
    replaceSculpture: { fr: "Remplacer la sculpture", en: "Replace sculpture" },
    removeSculpture: { fr: "Retirer la sculpture", en: "Remove sculpture" },
    sculptureOnPedestal: {
      fr: "Sculpture 3D — posée sur un socle blanc dans la salle. Marchez jusqu'à elle pour la voir sous tous les angles.",
      en: "3D sculpture — standing on a white pedestal in the room. Walk up to it to see it from every angle.",
    },
  },
  share: {
    share: { fr: "Partager", en: "Share" },
    copyLink: { fr: "Copier le lien", en: "Copy link" },
    linkCopied: { fr: "Lien copié", en: "Link copied" },
    scanToOpen: { fr: "Scanner pour ouvrir", en: "Scan to open" },
    shareExhibition: { fr: "Partager cette exposition", en: "Share this exhibition" },
  },
  embed: {
    embedOnYourSite: { fr: "Intégrer sur votre site", en: "Embed on your site" },
    embedHint: {
      fr: "Collez ce code sur votre site ou un site tiers : l'exposition s'y affiche en visite 3D.",
      en: "Paste this code on your site or a third-party site: the exhibition shows there as a 3D visit.",
    },
    embedUrl: { fr: "Adresse d'intégration", en: "Embed address" },
    copyEmbedCode: { fr: "Copier le code", en: "Copy the code" },
    embedCodeCopied: { fr: "Code copié", en: "Code copied" },
    copyEmbedUrl: { fr: "Copier l'adresse", en: "Copy the address" },
    embedUrlCopied: { fr: "Adresse copiée", en: "Address copied" },
    embedWidth: { fr: "Largeur", en: "Width" },
    embedHeight: { fr: "Hauteur (px)", en: "Height (px)" },
    embedCopyFailed: {
      fr: "La copie n'a pas fonctionné — sélectionnez le code et copiez-le.",
      en: "Copy did not work — select the code and copy it.",
    },
    notAvailable: { fr: "Exposition non disponible", en: "Exhibition not available" },
    notAvailableHint: {
      fr: "Cette exposition n'est pas publique, elle ne peut pas être intégrée sur un autre site.",
      en: "This exhibition is not public, so it cannot be embedded on another site.",
    },
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
    modelSunlightDesc: {
      fr: "Grande salle lumineuse sous sept verrières — lumière du jour, sol béton, panneaux autoportants.",
      en: "Bright hall under seven skylights — daylight, concrete floor, freestanding panels.",
    },
    modelSerpentineDesc: {
      fr: "Foire en plein air — quatre murs blancs serpentins sous le ciel, photos sur les deux faces, place en pierre et moquette grise.",
      en: "An open-air art fair — four curved white serpentine walls under the sky, photographs on both faces, a stone plaza and a grey carpet.",
    },
    modelVitrineDesc: {
      fr: "Galerie à façade vitrée — façade brique avec son enseigne « exhibit », devanture vitrée, sol béton, socles et étagères.",
      en: "A bright glass-front gallery — a brick facade with its “exhibit” sign, a glazed front, a concrete floor, pedestals and shelves.",
    },
    modelLoftDesc: {
      fr: "Loft sombre en béton — poutres, rails et spots, couleurs franches sur murs blancs, cloison et banc.",
      en: "A dark concrete loft — beams, rails and spotlights, bold colour on white walls, a partition and a bench.",
    },
    modelHalleDesc: {
      fr: "Grande halle design 25 × 34 m — paravents pliants en zigzag, plateformes et mobilier lounge, mobile suspendu à facettes et cerfs-volants.",
      en: "A 25 × 34 m design hall — zigzag folding screens, platforms and lounge furniture, a hanging faceted mobile and kites.",
    },
    modelArcheDesc: {
      fr: "Galerie en pierre — mur de séparation à arche ronde, niche, gravats et poutres en bois. La Galerie en Pierre d'origine.",
      en: "A stone gallery — a round-arch dividing wall, a niche, rubble and timber beams. The original Stone Gallery.",
    },
    modelMuseeDesc: {
      fr: "Salle de musée — mur bleu courbe, verrière en caissons, parquet chevrons et panneaux inclinés.",
      en: "A museum room — a curved blue wall, a coffered skylight, herringbone parquet and angled panels.",
    },
    modelClaireVoieDesc: {
      fr: "Galerie au sol sombre — immense peinture folk, mur de vinyle texte, bancs blancs et haute fenêtre claire-voie.",
      en: "A dark-floored gallery — a huge folk painting, a wall of text vinyl, white benches and a high clerestory window.",
    },
    modelParquetDesc: {
      fr: "Salle au parquet chevrons — cloisons en V, socles avec sculptures, mobile debout et accrochage salon.",
      en: "A herringbone-parquet room — V-shaped partitions, pedestals with sculptures, a standing mobile and a salon hang.",
    },
    modelVerriereDesc: {
      fr: "Grande halle 40 × 32 m sous plafond à caissons et verrières — cinq panneaux inclinés avec peintures, banc et pupitre d'étiquette.",
      en: "A 40 × 32 m hall under a coffered skylight ceiling — five angled panels with paintings, a bench and a label stand.",
    },
    modelPavillonDesc: {
      fr: "Pavillon lumineux — sol bois, murs en briques de verre, deux salles latérales, palmiers et pelouse dehors.",
      en: "A light pavilion — wood floor, glass-brick walls, two side rooms, palm trees and a lawn outside.",
    },
    modelClassiqueDesc: {
      fr: "Galerie classique — salle 8 × 40 m sous voûte à caissons, colonnes de granit, verrières dans la voûte.",
      en: "A classical gallery — an 8 × 40 m hall under a coffered vault, granite columns, skylights in the vault.",
    },
    modelAtriumBlancDesc: {
      fr: "Atrium blanc — sol laqué marbre, quatre colonnes, tambour noir suspendu au plafond.",
      en: "A white atrium — lacquered marble floor, four columns, a black drum suspended from the ceiling.",
    },
    modelPatioDesc: {
      fr: "Patio ovale — place de marbre sous une toiture percée d'un ovale, arbres, gravier noir et pelouse.",
      en: "An oval patio — a marble plaza under a roof pierced by an oval opening, trees, black gravel and a lawn.",
    },
    modelEscalierDesc: {
      fr: "Hall à escalier — 16 × 20 m, escalier de 14 marches, colonne centrale, mezzanine et verre.",
      en: "A stair hall — 16 × 20 m, a 14-step staircase, a central column, a mezzanine and glass.",
    },
    modelSallesVertesDesc: {
      fr: "Salles vertes — hall 14 × 32 m, murs verts, parquet bois, voûte, trois panneaux, deux bancs et verrière.",
      en: "Green rooms — a 14 × 32 m hall, green walls, wood floor, a vault, three panels, two benches and a skylight.",
    },
    modelCouloirSombreDesc: {
      fr: "Galerie élégante de nuit — hall 7 × 46 m, parquet chevrons, voûte, six panneaux, arches et spots chauds. La nuit, chaque tableau s'éclaire sous son propre projecteur.",
      en: "An elegant night gallery — a 7 × 46 m hall, herringbone parquet, a vault, six panels, arches and warm track spots. After dark, each painting glows under its own light.",
    },
    modelCouloirDoreDesc: {
      fr: "Couloir doré — hall 7 × 46 m, parquet chevrons, fenêtres en arche lumineuses, mur rouge au fond et taches de soleil au sol.",
      en: "A golden corridor — a 7 × 46 m hall, herringbone parquet, luminous arched windows, a red end wall and sun patches on the floor.",
    },
    modelVoutesDesc: {
      fr: "Plafond à voûtes — hall 10 × 30 m, parquet bois, plafond à écailles, deux panneaux et deux bancs.",
      en: "A vaulted ceiling — a 10 × 30 m hall, wood floor, a scale-pattern ceiling, two panels and two benches.",
    },
    modelCourbesDesc: {
      fr: "Courbes blanches — galerie circulaire, mur courbe blanc, section vitrée, palmiers et pelouse dehors.",
      en: "White curves — a circular gallery, a curved white wall, a glazed section, palm trees and a lawn outside.",
    },
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
    visibilityPublicDesc: { fr: "Listée sur Lakisa, ouverte à tous.", en: "Listed on Lakisa, open to everyone." },
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
    excludeFromFeed: { fr: "Ne pas publier dans le fil", en: "Don't publish to the feed" },
    excludeFromFeedDesc: {
      fr: "L'exposition sera publique mais n'apparaîtra pas dans le fil des publications.",
      en: "The exhibition will be public but won't appear in the publication feed.",
    },
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
    signIn: { fr: "Se connecter", en: "Sign in" },
    createAccount: { fr: "Créer un compte", en: "Create an account" },
    login: { fr: "Connexion", en: "Login" },
    or: { fr: "ou", en: "or" },
    yourName: { fr: "Votre nom", en: "Your name" },
    namePlaceholder: { fr: "Comment doit-on vous appeler ?", en: "How should we call you?" },
    yourRole: { fr: "Votre rôle", en: "Your role" },
    roleAria: { fr: "Votre rôle sur Lakisa", en: "Your role on Lakisa" },
    chooseRole: { fr: "Choisir votre rôle (facultatif)", en: "Choose your role (optional)" },
    country: { fr: "Pays", en: "Country" },
    countryPlaceholder: { fr: "Où êtes-vous basé ? (facultatif)", en: "Where are you based? (optional)" },
    email: { fr: "E-mail", en: "Email" },
    password: { fr: "Mot de passe", en: "Password" },
    passwordPlaceholder: { fr: "Votre mot de passe", en: "Your password" },
    showPassword: { fr: "Afficher le mot de passe", en: "Show password" },
    hidePassword: { fr: "Masquer le mot de passe", en: "Hide password" },
    passwordHint: {
      fr: "Utilisez au moins 10 caractères, dont une majuscule, une minuscule et un chiffre.",
      en: "Use at least 10 characters, including an uppercase letter, a lowercase letter and a number.",
    },
    rememberMe: { fr: "Se souvenir de moi", en: "Remember me" },
    forgot: { fr: "Mot de passe oublié ?", en: "Forgot?" },
    signUp: { fr: "S'INSCRIRE", en: "SIGN UP" },
    signInBtn: { fr: "SE CONNECTER", en: "SIGN IN" },
    alreadyHave: { fr: "Vous avez déjà un compte ?", en: "Already have an account?" },
    newToSanaa: { fr: "Nouveau sur Lakisa ?", en: "New to Lakisa?" },
    terms: {
      fr: "En continuant, vous acceptez d'utiliser Lakisa avec respect et de ne partager que des œuvres que vous avez le droit de publier.",
      en: "By continuing, you agree to use Lakisa respectfully and only share work you have permission to publish.",
    },
    couldNotCreateAccount: {
      fr: "Impossible de créer votre compte pour le moment.",
      en: "Could not create your account right now.",
    },
    couldNotSignIn: { fr: "Impossible de vous connecter pour le moment.", en: "Could not sign in right now." },
    somethingWrong: { fr: "Une erreur est survenue.", en: "Something went wrong." },
    rights: { fr: "© 2026 Lakisa Studio. Tous droits réservés.", en: "© 2026 Lakisa Studio. All rights reserved." },
  },
  settings: {
    language: { fr: "Langue", en: "Language" },
    languageDesc: {
      fr: "Choisissez la langue de tout le site. L'anglais est la langue par défaut — passez au français quand vous voulez.",
      en: "Choose the language for the whole site. English is the default — switch to French any time.",
    },
    title: { fr: "Paramètres", en: "Settings" },
    yourAccount: { fr: "VOTRE COMPTE", en: "YOUR ACCOUNT" },
    settingsDesc: {
      fr: "Votre profil, votre mot de passe, et l'apparence de Lakisa.",
      en: "Your profile, your password, and how Lakisa looks.",
    },
    appearance: { fr: "Apparence", en: "Appearance" },
    appearanceDesc: {
      fr: "Choisissez l'apparence de Lakisa sur cet appareil. Système suit le réglage de votre appareil.",
      en: "Choose how Lakisa looks on this device. System follows your device setting.",
    },
    light: { fr: "Clair", en: "Light" },
    dark: { fr: "Sombre", en: "Dark" },
    system: { fr: "Système", en: "System" },
    profile: { fr: "Profil", en: "Profile" },
    profileDesc: {
      fr: "C'est ainsi que votre nom apparaît dans votre espace de travail.",
      en: "This is how your name appears across your workspace.",
    },
    memberSince: { fr: "Membre depuis", en: "Member since" },
    exhibition: { fr: "exposition", en: "exhibition" },
    exhibitions: { fr: "expositions", en: "exhibitions" },
    yourName: { fr: "Votre nom", en: "Your name" },
    email: { fr: "E-mail", en: "Email" },
    emailNote: {
      fr: "Votre adresse e-mail ne peut pas être changée. Elle identifie votre compte.",
      en: "Your email address can't be changed. It identifies your account.",
    },
    saveChanges: { fr: "Enregistrer les modifications", en: "Save changes" },
    saving: { fr: "Enregistrement…", en: "Saving…" },
    saved: { fr: "Enregistré.", en: "Saved." },
    uploadAvatar: { fr: "Mettre une photo de profil", en: "Upload a profile photo" },
    uploading: { fr: "Envoi…", en: "Uploading…" },
    removeAvatar: { fr: "Retirer la photo", en: "Remove photo" },
    avatarSaved: { fr: "Photo de profil enregistrée.", en: "Profile photo saved." },
    avatarRemoved: { fr: "Photo de profil retirée.", en: "Profile photo removed." },
    couldNotUploadAvatar: {
      fr: "Impossible de mettre en ligne cette photo.",
      en: "Could not upload this photo.",
    },
    avatarHint: {
      fr: "JPG, PNG ou WebP. La photo est recadrée en carré.",
      en: "JPG, PNG or WebP. The photo is cropped square.",
    },
    yourBio: { fr: "Votre biographie", en: "Your biography" },
    bioPlaceholder: {
      fr: "Quelques lignes sur vous et votre travail…",
      en: "A few lines about you and your work…",
    },
    bioHint: {
      fr: "Affichée sur votre page publique « Mes travaux » et sur votre site d'artiste.",
      en: "Shown on your public “My works” page and on your artist site.",
    },
    couldNotUpdateProfile: {
      fr: "Impossible de mettre à jour votre profil pour le moment.",
      en: "Could not update your profile right now.",
    },
    password: { fr: "Mot de passe", en: "Password" },
    passwordDesc: {
      fr: "Changez votre mot de passe. Vous resterez connecté sur cet appareil.",
      en: "Change your password. You'll stay signed in on this device.",
    },
    currentPassword: { fr: "Mot de passe actuel", en: "Current password" },
    newPassword: { fr: "Nouveau mot de passe", en: "New password" },
    confirmNewPassword: { fr: "Confirmer le nouveau mot de passe", en: "Confirm new password" },
    passwordHint: {
      fr: "Au moins 10 caractères, dont une majuscule, une minuscule et un chiffre.",
      en: "At least 10 characters, including an uppercase letter, a lowercase letter and a number.",
    },
    passwordPlaceholder: { fr: "Au moins 10 caractères", en: "At least 10 characters" },
    changePassword: { fr: "Changer le mot de passe", en: "Change password" },
    passwordsDontMatch: {
      fr: "Les nouveaux mots de passe ne correspondent pas.",
      en: "The new passwords don't match.",
    },
    passwordChanged: { fr: "Mot de passe changé.", en: "Password changed." },
    couldNotChangePassword: {
      fr: "Impossible de changer votre mot de passe pour le moment.",
      en: "Could not change your password right now.",
    },
    session: { fr: "Session", en: "Session" },
    sessionDesc: { fr: "Se déconnecter de Lakisa sur cet appareil.", en: "Sign out of Lakisa on this device." },
    deleteAccount: { fr: "Supprimer le compte", en: "Delete account" },
    deleteAccountDesc: {
      fr: "Supprimer définitivement votre compte et toutes vos expositions et œuvres. Irréversible.",
      en: "Permanently delete your account and all your exhibitions and artworks. This can't be undone.",
    },
    deleteMyAccount: { fr: "Supprimer mon compte", en: "Delete my account" },
    clickAgainToConfirm: { fr: "Cliquer à nouveau pour confirmer", en: "Click again to confirm" },
    deleting: { fr: "Suppression…", en: "Deleting…" },
    couldNotDeleteAccount: {
      fr: "Impossible de supprimer votre compte pour le moment.",
      en: "Could not delete your account right now.",
    },
  },
  // Dashboard (workspace home).
  dashboard: {
    creativeSpace: { fr: "VOTRE ESPACE CRÉATIF", en: "YOUR CREATIVE SPACE" },
    hello: { fr: "Bonjour,", en: "Hello," },
    overview: { fr: "Voici un aperçu de votre travail sur Lakisa.", en: "Here is an overview of your work on Lakisa." },
    searchPlaceholder: { fr: "Rechercher vos expositions…", en: "Search your exhibitions…" },
    searchAria: { fr: "Rechercher vos expositions", en: "Search your exhibitions" },
    createExhibition: { fr: "Créer une exposition", en: "Create an exhibition" },
    creating: { fr: "Création…", en: "Creating…" },
    myExhibitions: { fr: "Mes expositions", en: "My exhibitions" },
    myArtworks: { fr: "Mes œuvres", en: "My artworks" },
    totalVisits: { fr: "Visites totales", en: "Total visits" },
    publicExhibitions: { fr: "Expositions publiques", en: "Public exhibitions" },
    yourStatistics: { fr: "Vos statistiques", en: "Your statistics" },
    activity: { fr: "Activité", en: "Activity" },
    yourActivity: { fr: "Votre activité", en: "Your activity" },
    artworksPerDay: { fr: "Œuvres ajoutées par jour ·", en: "Artworks added per day ·" },
    newIn14Days: { fr: "nouvelles en 14 jours", en: "new in 14 days" },
    last7Days: { fr: "7 derniers jours", en: "Last 7 days" },
    previous7Days: { fr: "7 jours précédents", en: "Previous 7 days" },
    artworkAdded: { fr: "œuvre ajoutée", en: "artwork added" },
    artworksAdded: { fr: "œuvres ajoutées", en: "artworks added" },
    mostVisited: { fr: "Les plus visitées", en: "Most visited" },
    topExhibitions: { fr: "Meilleures expositions par visites", en: "Top exhibitions by visits" },
    yourMostVisited: { fr: "Vos salles les plus visitées", en: "Your most visited rooms" },
    seeAll: { fr: "Voir toutes les expositions", en: "See all exhibitions" },
    noExhibitionsYet: {
      fr: "Aucune exposition pour l'instant — créez la première pour commencer.",
      en: "No exhibitions yet — create your first one to start.",
    },
    noExhibitionsMatch: {
      fr: "Aucune exposition ne correspond à votre recherche.",
      en: "No exhibitions match your search.",
    },
    exhibition: { fr: "Exposition", en: "Exhibition" },
    status: { fr: "Statut", en: "Status" },
    artworks: { fr: "Œuvres", en: "Artworks" },
    visits: { fr: "Visites", en: "Visits" },
    public: { fr: "Publique", en: "Public" },
    draft: { fr: "Brouillon", en: "Draft" },
    couldNotCreate: { fr: "Impossible de créer une exposition.", en: "Could not create an exhibition." },
  },
  // Public homepage.
  home: {
    explore: { fr: "Explorer", en: "Explore" },
    exhibitions: { fr: "Expositions", en: "Exhibitions" },
    create: { fr: "Créer", en: "Create" },
    resources: { fr: "Ressources", en: "Resources" },
    whatWeDo: { fr: "Ce que nous faisons", en: "What we do" },
    about: { fr: "À propos", en: "About" },
    signIn: { fr: "Se connecter", en: "Sign in" },
    eyebrow: { fr: "Expositions virtuelles · Ouvertes à tous", en: "Virtual exhibitions · Open to everyone" },
    title: { fr: "Parcourez l'art, d'où que vous soyez.", en: "Walk through art, from anywhere." },
    subtitle: {
      fr: "Entrez dans des expositions créées par des artistes du monde entier. Parcourez les salles, tenez-vous devant les œuvres, explorez à votre rythme — aucun compte nécessaire pour visiter.",
      en: "Step inside exhibitions built by artists from all over the world. Wander the rooms, stand in front of the work, explore at your own pace — no account needed to visit.",
    },
    visitExhibition: { fr: "Visiter une exposition", en: "Visit an exhibition" },
    createMyOwn: { fr: "Créer la mienne", en: "Create my own" },
    livePreview: { fr: "Aperçu en direct", en: "Live preview" },
    floorMap: { fr: "Étage 1 · Plan", en: "Floor 1 · Map" },
    visit: { fr: "Visiter", en: "Visit" },
    trending: { fr: "Expositions en vogue", en: "Trending exhibitions" },
    browseAll: { fr: "Parcourir toutes les expositions", en: "Browse all exhibitions" },
    browseExhibitions: { fr: "Parcourir les expositions", en: "Browse exhibitions" },
    noPublicYet: { fr: "Aucune exposition publique pour l'instant.", en: "No public exhibitions yet." },
    beFirst: {
      fr: "Soyez le premier à ouvrir une salle et à inviter le monde.",
      en: "Be the first to open a room and invite the world in.",
    },
    createAccount: { fr: "Créer un compte", en: "Create an account" },
    aboutTitle: { fr: "À propos de Lakisa", en: "About Lakisa" },
    aboutText: {
      fr: "Lakisa est une plateforme d'expositions virtuelles où les artistes construisent des salles, accrochent leurs œuvres et invitent le monde à les parcourir — d'où que ce soit. Aucun téléchargement, aucun compte nécessaire pour visiter.",
      en: "Lakisa is a virtual exhibition platform where artists build rooms, hang their work, and invite the world to walk through — from anywhere. No downloads, no account needed to visit.",
    },
    artwork: { fr: "œuvre", en: "artwork" },
    artworks: { fr: "œuvres", en: "artworks" },
  },
  // Site footer (public homepage and /about) — original Lakisa copy.
  footer: {
    about: { fr: "À propos", en: "About" },
    aboutLakisa: { fr: "À propos de Lakisa", en: "About Lakisa" },
    whatWeDo: { fr: "Ce que nous faisons", en: "What we do" },
    contact: { fr: "Contact", en: "Contact" },
    resources: { fr: "Ressources", en: "Resources" },
    userGuide: { fr: "Guide d'utilisation", en: "User guide" },
    allTools: { fr: "Tous les outils", en: "All tools" },
    partnerships: { fr: "Partenariats", en: "Partnerships" },
    help: { fr: "Aide", en: "Help" },
    helpCentre: { fr: "Centre d'aide", en: "Help centre" },
    contactUs: { fr: "Nous contacter", en: "Contact us" },
    terms: { fr: "Conditions d'utilisation", en: "Terms of Use" },
    privacy: { fr: "Politique de confidentialité", en: "Privacy Policy" },
    copyright: { fr: "© 2026 Lakisa", en: "© 2026 Lakisa" },
    follow: { fr: "Suivez Lakisa", en: "Follow Lakisa" },
    socialInstagram: { fr: "Lakisa sur Instagram", en: "Lakisa on Instagram" },
    socialFacebook: { fr: "Lakisa sur Facebook", en: "Lakisa on Facebook" },
    socialLinkedin: { fr: "Lakisa sur LinkedIn", en: "Lakisa on LinkedIn" },
    socialYoutube: { fr: "Lakisa sur YouTube", en: "Lakisa on YouTube" },
    socialX: { fr: "Lakisa sur X", en: "Lakisa on X" },
    socialPending: {
      fr: "Compte à venir — lien à remplacer",
      en: "Account coming soon — link to replace",
    },
  },
  // About page (/about) — original Lakisa copy.
  about: {
    eyebrow: { fr: "À propos", en: "About" },
    title: {
      fr: "L'art mérite une salle, pas seulement une image.",
      en: "Art deserves a room, not just an image.",
    },
    intro: {
      fr: "Lakisa est une plateforme d'expositions virtuelles. Les artistes y construisent des salles, accrochent leurs œuvres et invitent le monde à les parcourir — d'où que ce soit, sans téléchargement et sans compte pour visiter. Lakisa est née à Kampala, d'un peintre qui voulait que ses toiles se visitent comme elles se regardent : en marchant devant elles.",
      en: "Lakisa is a virtual exhibition platform. Artists build rooms here, hang their work, and invite the world to walk through — from anywhere, with no download and no account needed to visit. Lakisa was born in Kampala, from a painter who wanted his canvases to be visited the way they are looked at: by walking up to them.",
    },
    whatWeDoTitle: { fr: "Ce que nous faisons", en: "What we do" },
    whatWeDoIntro: {
      fr: "Trois gestes simples, du premier fichier à la visite partagée.",
      en: "Three simple moves, from the first file to the shared visit.",
    },
    buildTitle: { fr: "Construire des salles", en: "Build rooms" },
    buildText: {
      fr: "Choisissez une salle parmi les modèles de galerie, réglez sa lumière, ses murs et son sol. Chaque salle garde son plan : on s'y déplace comme dans un lieu réel.",
      en: "Pick a room from the gallery models, set its light, walls and floor. Every room keeps its floor plan: you move through it like a real place.",
    },
    hangTitle: { fr: "Accrocher et présenter", en: "Hang and present" },
    hangText: {
      fr: "Mettez vos œuvres en ligne, encadrez-les, accrochez-les au mur et rédigez leurs cartels. Tarifez, tenez votre inventaire et préparez les documents qui accompagnent une vente.",
      en: "Upload your work, frame it, hang it on the wall and write its labels. Price it, keep your inventory, and prepare the documents that go with a sale.",
    },
    inviteTitle: { fr: "Inviter le monde", en: "Invite the world" },
    inviteText: {
      fr: "Publiez l'exposition et partagez son lien : les visiteurs entrent, marchent de salle en salle et s'arrêtent devant les œuvres. Aucun compte nécessaire pour visiter.",
      en: "Publish the show and share its link: visitors walk in, move from room to room and stop in front of the works. No account needed to visit.",
    },
    guideTitle: { fr: "Guide d'utilisation", en: "User guide" },
    guideVisitTitle: { fr: "Visiter", en: "Visit" },
    guideVisitText: {
      fr: "Ouvrez une exposition depuis l'accueil, entrez dans la salle et marchez : cliquez sur le sol pour avancer, glissez pour regarder autour de vous. Le mini-plan en bas de l'écran vous permet de changer de salle.",
      en: "Open an exhibition from the homepage, step into the room and walk: click the floor to move forward, drag to look around. The mini-plan at the bottom of the screen lets you switch rooms.",
    },
    guideCreateTitle: { fr: "Créer", en: "Create" },
    guideCreateText: {
      fr: "Créez un compte, mettez vos œuvres en ligne, choisissez une salle et accrochez-les. Les outils — tarifs, inventaire, cadres, portfolio — sont réunis sous « Ressources ».",
      en: "Create an account, upload your work, pick a room and hang it. The tools — pricing, inventory, frames, portfolio — all live under “Resources”.",
    },
    guidePublishTitle: { fr: "Publier", en: "Publish" },
    guidePublishText: {
      fr: "Quand l'accrochage vous plaît, publiez l'exposition et partagez le lien. Vous pouvez aussi la garder privée, la protéger par mot de passe ou ne la partager qu'avec un lien.",
      en: "When the hang feels right, publish the show and share the link. You can also keep it private, protect it with a password, or share it by link only.",
    },
    helpTitle: { fr: "Centre d'aide", en: "Help centre" },
    faq1q: { fr: "Faut-il un compte pour visiter ?", en: "Do I need an account to visit?" },
    faq1a: {
      fr: "Non. Toutes les expositions publiques se visitent librement, sans compte et sans téléchargement. Un compte sert seulement à créer et à publier vos propres expositions.",
      en: "No. Every public exhibition is free to visit, with no account and no download. An account is only needed to create and publish your own exhibitions.",
    },
    faq2q: { fr: "Combien coûte Lakisa ?", en: "How much does Lakisa cost?" },
    faq2a: {
      fr: "Visiter est gratuit. La création d'expositions et l'accès aux outils se font depuis votre espace de travail après inscription — les tarifs sont indiqués dans votre espace de travail.",
      en: "Visiting is free. Creating exhibitions and using the tools happens in your workspace after sign-up — pricing is shown inside your workspace.",
    },
    faq3q: { fr: "Puis-je vendre une œuvre vue dans une exposition ?", en: "Can I buy a work I see in an exhibition?" },
    faq3a: {
      fr: "Quand l'artiste a activé la vente sur une œuvre, un bouton permet de le contacter ou de faire une demande. Lakisa ne vend pas les œuvres : la vente se conclut entre l'artiste et l'acheteur.",
      en: "When the artist has enabled selling on a work, a button lets you contact them or make an enquiry. Lakisa does not sell the works: the sale is agreed between the artist and the buyer.",
    },
    contactTitle: { fr: "Nous contacter", en: "Contact us" },
    contactText: {
      fr: "Une question, une idée, un partenariat ? Écrivez à l'équipe Lakisa — nous lisons chaque message.",
      en: "A question, an idea, a partnership? Write to the Lakisa team — we read every message.",
    },
    backHome: { fr: "Retour à l'accueil", en: "Back to home" },
  },
  // Legal pages (/terms, /privacy) — chrome only; the legal body itself
  // is English (the language of Lakisa's legal documents) and lives in
  // the page components. Original Lakisa copy.
  legal: {
    backHome: { fr: "Retour à l'accueil", en: "Back to home" },
    lastUpdated: { fr: "Dernière mise à jour : 9 novembre 2026", en: "Last updated: 9 November 2026" },
    translationNote: {
      fr: "Ce document est rédigé en anglais, la langue des documents juridiques de Lakisa. Une traduction française est prévue.",
      en: "This document is written in English, the language of Lakisa's legal documents. A French translation is planned.",
    },
    termsEyebrow: { fr: "Documents juridiques", en: "Legal" },
    termsTitle: { fr: "Conditions d'utilisation", en: "Terms of Use" },
    termsIntro: {
      fr: "Les règles qui régissent l'utilisation de Lakisa.",
      en: "The rules that govern using Lakisa.",
    },
    privacyEyebrow: { fr: "Documents juridiques", en: "Legal" },
    privacyTitle: { fr: "Politique de confidentialité", en: "Privacy Policy" },
    privacyIntro: {
      fr: "Quelles données Lakisa collecte, pourquoi, et ce que vous pouvez en faire.",
      en: "What data Lakisa collects, why, and what you can do about it.",
    },
    contactLine: {
      fr: "Pour toute question sur ce document, écrivez à contact@kabeyailunga.com.",
      en: "For any question about this document, write to contact@kabeyailunga.com.",
    },
  },
  // User guide (/guide) — chrome only; the guide body is fully
  // bilingual (EN/FR) and lives in the guide component.
  guide: {
    eyebrow: { fr: "Guide d'utilisation", en: "User guide" },
    title: { fr: "Comment utiliser Lakisa", en: "How to use Lakisa" },
    intro: {
      fr: "De la création de votre compte à votre première exposition partagée : chaque étape, dans l'ordre.",
      en: "From creating your account to sharing your first exhibition: every step, in order.",
    },
    backHome: { fr: "Retour à l'accueil", en: "Back to home" },
    onThisPage: { fr: "Dans ce guide", en: "In this guide" },
    needHelp: { fr: "Besoin d'aide ?", en: "Need help?" },
    needHelpText: {
      fr: "Écrivez-nous à contact@kabeyailunga.com — nous lisons chaque message.",
      en: "Write to us at contact@kabeyailunga.com — we read every message.",
    },
  },
  // Galleries catalogue page (/galleries).
  galleries: {
    title: { fr: "Lakisa Galerie", en: "Lakisa Galerie" },
    roomsCollection: { fr: "SALLES · UNE COLLECTION", en: "ROOMS · ONE COLLECTION" },
    intro: {
      fr: "salles de galerie, chacune avec sa lumière, ses murs et son sol. Choisissez-en une à parcourir, ou ouvrez-la dans l'éditeur et accrochez vos œuvres.",
      en: "gallery rooms, each with its own light, walls and floor. Pick one to walk through, or open it in the editor and hang your work.",
    },
    livePreview: { fr: "APERÇU 3D EN DIRECT", en: "LIVE 3D PREVIEW" },
    openInEditor: { fr: "Ouvrir dans l'éditeur", en: "Open in editor" },
    opening: { fr: "Ouverture…", en: "Opening…" },
    save: { fr: "Enregistrer", en: "Save" },
    saved: { fr: "Enregistré", en: "Saved" },
    saveAsFavourite: { fr: "Enregistrer comme favori", en: "Save as favourite" },
    removeFromFavourites: { fr: "Retirer des favoris", en: "Remove from favourites" },
    walkThrough: { fr: "Parcourir", en: "Walk through" },
    exitWalk: { fr: "Quitter la visite", en: "Exit walk" },
    walkHint: {
      fr: "Mode visite · Cliquez sur le sol pour marcher · ZQSD pour bouger · Glisser pour regarder",
      en: "Walk mode · Click the floor to walk · WASD to move · Drag to look",
    },
    insideHint: {
      fr: "Dans la salle · Glisser pour regarder · Molette pour zoomer",
      en: "Inside the room · Drag to look around · Scroll to zoom",
    },
    searchPlaceholder: { fr: "Rechercher des galeries…", en: "Search galleries…" },
    searchAria: { fr: "Rechercher des galeries par nom ou description", en: "Search galleries by name or description" },
    filterByCategory: { fr: "Filtrer par catégorie", en: "Filter by category" },
    all: { fr: "Toutes", en: "All" },
    favourites: { fr: "Favoris", en: "Favourites" },
    showingAll: { fr: "Affichage des {count} salles.", en: "Showing all {count} rooms." },
    showingSome: { fr: "Affichage de {shown} salles sur {total}.", en: "Showing {shown} of {total} rooms." },
    favouritesNote: {
      fr: "Les favoris sont enregistrés dans ce navigateur uniquement — ils ne se synchronisent pas encore avec votre compte.",
      en: "Favourites are saved in this browser only — they do not sync to your account yet.",
    },
    viewIn3d: { fr: "Voir en 3D", en: "View in 3D" },
    previewIn3d: { fr: "Aperçu en 3D", en: "Preview in 3D" },
    noMatch: { fr: "Aucune galerie ne correspond à cette recherche.", en: "No galleries match that search." },
    noFavouritesYet: {
      fr: "Vous n'avez encore enregistré aucun favori — touchez l'étoile d'une salle pour l'enregistrer ici.",
      en: "You have not saved any favourites yet — tap the star on a room to save it here.",
    },
    tryDifferent: { fr: "Essayez un autre mot, ou effacez les filtres.", en: "Try a different word, or clear the filters." },
    clearFilters: { fr: "Effacer les filtres", en: "Clear filters" },
    walls: { fr: "murs", en: "walls" },
    floor: { fr: "sol", en: "floor" },
    high: { fr: "de haut", en: "high" },
    categoryArchitectural: { fr: "Architecturale", en: "Architectural" },
    couldNotOpen: {
      fr: "Impossible d'ouvrir cette salle dans l'éditeur.",
      en: "Could not open this room in the editor.",
    },
    couldNotCreate: { fr: "Impossible de créer une exposition.", en: "Could not create an exhibition." },
    signIn: { fr: "Se connecter", en: "Sign in" },
  },
  // My exhibitions page (/exhibitions).
  exhibitions: {
    exhibitions: { fr: "Expositions", en: "Exhibitions" },
    yourExhibitions: { fr: "VOS EXPOSITIONS ·", en: "YOUR EXHIBITIONS ·" },
    title: { fr: "Vos expositions", en: "Your exhibitions" },
    copy: {
      fr: "Tout ce que vous construisez — brouillons et salles publiées, au même endroit.",
      en: "Everything you are building — drafts and published rooms, in one place.",
    },
    createNew: { fr: "Créer une nouvelle exposition", en: "Create a new exhibition" },
    creating: { fr: "Création…", en: "Creating…" },
    noExhibitions: { fr: "Aucune exposition pour l'instant.", en: "No exhibitions yet." },
    firstRoom: {
      fr: "Votre première salle commence ici — choisissez une galerie, accrochez vos œuvres, publiez-la.",
      en: "Your first room starts here — pick a gallery, hang your work, publish it.",
    },
    continueBuilding: { fr: "Continuer à construire", en: "Continue building" },
    visit: { fr: "Visiter", en: "Visit" },
    delete: { fr: "Supprimer", en: "Delete" },
    clickAgainDelete: { fr: "Cliquer à nouveau pour supprimer", en: "Click again to delete" },
    deleting: { fr: "Suppression…", en: "Deleting…" },
    published: { fr: "Publiée", en: "Published" },
    draft: { fr: "Brouillon", en: "Draft" },
    room: { fr: "salle", en: "room" },
    rooms: { fr: "salles", en: "rooms" },
    artwork: { fr: "œuvre", en: "artwork" },
    artworks: { fr: "œuvres", en: "artworks" },
    visitSingular: { fr: "visite", en: "visit" },
    visits: { fr: "visites", en: "visits" },
    couldNotCreate: { fr: "Impossible de créer une exposition.", en: "Could not create an exhibition." },
    couldNotDelete: { fr: "Impossible de supprimer cette exposition.", en: "Could not delete this exhibition." },
  },
  // Reusable artwork library (/artworks) — "Mes œuvres".
  library: {
    library: { fr: "Mes œuvres", en: "My artworks" },
    yourLibrary: { fr: "VOS ŒUVRES ·", en: "YOUR ARTWORKS ·" },
    title: { fr: "Mes œuvres", en: "My artworks" },
    copy: {
      fr: "Toutes les œuvres que vous avez déjà téléversées, toutes expositions confondues. Réutilisez-les dans une nouvelle exposition sans les téléverser à nouveau.",
      en: "Every artwork you have already uploaded, across all your exhibitions. Reuse them in a new exhibition without uploading them again.",
    },
    searchPlaceholder: { fr: "Rechercher une œuvre…", en: "Search your artworks…" },
    searchAria: { fr: "Rechercher vos œuvres", en: "Search your artworks" },
    noWorks: { fr: "Aucune œuvre pour l'instant.", en: "No artworks yet." },
    noWorksDesc: {
      fr: "Téléversez une œuvre dans une exposition — elle apparaîtra ici et vous pourrez la réutiliser ailleurs.",
      en: "Upload an artwork in an exhibition — it will appear here and you can reuse it elsewhere.",
    },
    noMatch: { fr: "Aucune œuvre ne correspond à cette recherche.", en: "No artwork matches this search." },
    inExhibitions: { fr: "Dans", en: "In" },
    exhibition: { fr: "exposition", en: "exhibition" },
    exhibitions: { fr: "expositions", en: "exhibitions" },
    notInExhibition: { fr: "Dans aucune exposition", en: "In no exhibition" },
    addToExhibition: { fr: "Ajouter à une exposition", en: "Add to an exhibition" },
    chooseExhibition: { fr: "Choisir une exposition…", en: "Choose an exhibition…" },
    adding: { fr: "Ajout…", en: "Adding…" },
    addedTo: { fr: "Ajoutée à", en: "Added to" },
    delete: { fr: "Supprimer", en: "Delete" },
    clickAgainDelete: { fr: "Cliquer à nouveau pour supprimer", en: "Click again to delete" },
    deleting: { fr: "Suppression…", en: "Deleting…" },
    deleteWarning: {
      fr: "Suppression définitive : l'œuvre quittera votre bibliothèque et toutes les expositions où elle est accrochée.",
      en: "This deletes the work for good: it leaves your library and every exhibition where it hangs.",
    },
    couldNotLoad: { fr: "Impossible de charger vos œuvres.", en: "Could not load your artworks." },
    couldNotAdd: { fr: "Impossible d'ajouter cette œuvre à l'exposition.", en: "Could not add this artwork to the exhibition." },
    couldNotDelete: { fr: "Impossible de supprimer cette œuvre.", en: "Could not delete this artwork." },
    fromLibrary: { fr: "Depuis mes œuvres", en: "From my works" },
    chooseFromLibrary: { fr: "Choisir parmi mes œuvres", en: "Choose from my works" },
    libraryEmpty: {
      fr: "Aucune œuvre dans votre bibliothèque pour l'instant.",
      en: "No artworks in your library yet.",
    },
    reuseHint: {
      fr: "La même image est réutilisée — aucun nouveau téléversement.",
      en: "The same image is reused — no new upload.",
    },
  },
  // Public creator wall (/works/[id]) — "Mes travaux / designs / créations".
  works: {
    eyebrow: { fr: "MES TRAVAUX · DESIGNS · CRÉATIONS", en: "MY WORKS · DESIGNS · CREATIONS" },
    filterByType: { fr: "Filtrer par type", en: "Filter by type" },
    all: { fr: "Tout", en: "All" },
    oeuvre: { fr: "Œuvres", en: "Artworks" },
    design: { fr: "Designs", en: "Designs" },
    creation: { fr: "Créations", en: "Creations" },
    work: { fr: "œuvre", en: "work" },
    works: { fr: "œuvres", en: "works" },
    manageExhibitions: { fr: "Gérer mes expositions", en: "Manage my exhibitions" },
    goToExhibitions: { fr: "Aller à mes expositions", en: "Go to my exhibitions" },
    noWorksYet: { fr: "Aucune œuvre pour l'instant.", en: "No works yet." },
    noWorksYetDesc: {
      fr: "Créez une exposition et accrochez vos premières œuvres — elles apparaîtront ici.",
      en: "Create an exhibition and hang your first works — they will show up here.",
    },
    noWorksInKind: { fr: "Rien dans cette catégorie pour l'instant.", en: "Nothing in this category yet." },
    noWorksInKindDesc: {
      fr: "Taguez vos œuvres depuis cette page (si c'est la vôtre) pour les faire apparaître ici.",
      en: "Tag your works from this page (if it is yours) to make them appear here.",
    },
    type: { fr: "Type", en: "Type" },
    couldNotSaveKind: { fr: "Impossible d'enregistrer ce type.", en: "Could not save this type." },
    myWorks: { fr: "Mes travaux", en: "My works" },
    viewPublicPage: { fr: "Voir ma page publique", en: "View my public page" },
  },
  // Explore page (/explore) — other artists' public exhibitions.
  explore: {
    explore: { fr: "Explorer", en: "Explore" },
    exploreOther: { fr: "EXPLORER · AUTRES ARTISTES", en: "EXPLORE · OTHER ARTISTS" },
    exploreOtherPublic: { fr: "EXPLORER · EXPOSITIONS D'AUTRES ARTISTES", en: "EXPLORE · EXHIBITIONS BY OTHER ARTISTS" },
    title: { fr: "D'autres salles, d'autres artistes", en: "Other rooms, other artists" },
    copySignedIn: {
      fr: "Expositions publiques d'autres artistes, commissaires et galeries — parcourez-les pour vous inspirer.",
      en: "Public exhibitions by other artists, curators and galleries — walk through them for inspiration.",
    },
    copyPublic: {
      fr: "Chaque exposition publique sur Lakisa, créée par quelqu'un d'autre — entrez et parcourez leurs salles à votre rythme. Aucun compte nécessaire pour visiter.",
      en: "Every public exhibition on Lakisa, made by someone else — wander in and walk through their rooms at your own pace. No account needed to visit.",
    },
    noPublic: {
      fr: "Aucune exposition publique d'autres artistes pour l'instant.",
      en: "No public exhibitions from other artists yet.",
    },
    noPublicDesc: {
      fr: "Quand d'autres artistes publieront une salle, elle apparaîtra ici.",
      en: "When other artists publish a room, it will appear here.",
    },
    createAccount: { fr: "Créer un compte", en: "Create an account" },
    visitExhibition: { fr: "Visiter l'exposition", en: "Visit exhibition" },
    visit: { fr: "Visiter", en: "Visit" },
    galleries: { fr: "Galeries", en: "Galleries" },
    signIn: { fr: "Se connecter", en: "Sign in" },
  },
  // Publication feed (/feed) — published exhibitions, newest first.
  feed: {
    feed: { fr: "Fil", en: "Feed" },
    eyebrow: { fr: "LAKISA · EXPOSITIONS", en: "LAKISA · EXHIBITIONS" },
    title: { fr: "Un monde d'art, à parcourir", en: "A world of art, open to wander" },
    copy: {
      fr: "Entrez dans les expositions créées par les artistes de Lakisa.",
      en: "Step inside exhibitions created by artists across Lakisa.",
    },
    feedLabel: { fr: "Fil des expositions", en: "Exhibition feed" },
    loading: { fr: "Chargement des expositions…", en: "Loading exhibitions…" },
    empty: {
      fr: "Aucune exposition publiée pour le moment. Les expositions apparaîtront ici dès leur publication.",
      en: "No published exhibitions yet. When an artist opens an exhibition, it will appear here.",
    },
    loadMore: { fr: "Voir la suite", en: "Load more" },
    loadingMore: { fr: "Chargement…", en: "Loading…" },
    visit: { fr: "Visiter l'exposition", en: "Visit exhibition" },
    like: { fr: "Aimer l'exposition", en: "Like exhibition" },
    unlike: { fr: "Retirer le j'aime", en: "Remove like" },
    error: {
      fr: "Impossible de charger les expositions. Veuillez réessayer.",
      en: "We couldn't load the exhibitions. Please try again.",
    },
    signIn: { fr: "Connectez-vous à Lakisa pour aimer une exposition.", en: "Sign in to Lakisa to like an exhibition." },
    likeError: {
      fr: "Votre j'aime n'a pas pu être enregistré. Veuillez réessayer.",
      en: "Your like could not be saved. Please try again.",
    },
    retry: { fr: "Réessayer", en: "Try again" },
  },
  // Tools hub (/tools) — tool titles and descriptions.
  tools: {
    title: { fr: "Outils", en: "Tools" },
    eyebrow: {
      fr: "OUTILS POUR ARTISTES, COMMISSAIRES, GALERIES ET COLLECTIONNEURS",
      en: "TOOLS FOR ARTISTS, CURATORS, GALLERIES & COLLECTORS",
    },
    description: {
      fr: "Les outils quotidiens du monde de l'art, dans votre espace de travail — tarifer une œuvre, tenir votre inventaire, connaître vos contacts, présenter et vendre, et imprimer les documents qui accompagnent une vente.",
      en: "The everyday tools of the art world, inside your workspace — price a work, keep your inventory, know your contacts, present and sell, and print the documents that go with a sale.",
    },
    open: { fr: "Ouvrir", en: "Open" },
    readMore: { fr: "Lire la suite", en: "Read more" },
    whoItIsFor: { fr: "POUR QUI", en: "WHO IT IS FOR" },
    onePlatform: {
      fr: "Une plateforme, adaptée à votre façon de travailler.",
      en: "One platform, shaped to how you work.",
    },
    artInContext: { fr: "L'art en contexte", en: "Art in Context" },
    artInContextDesc: {
      fr: "Un parcours guidé de la mise en ligne à la promotion — photographie, couleur, cadres, maquettes, galerie 3D, publication et export, sur les mêmes œuvres.",
      en: "One guided path from upload to promotion — photography, colour, frames, mockups, the 3D gallery, publication and export, all on the same artworks.",
    },
    priceYourWork: { fr: "Tarifer mon travail", en: "Price your work" },
    priceYourWorkDesc: {
      fr: "Calculez un prix juste pour une pièce, à partir de vos heures, de vos matériaux et de sa taille.",
      en: "Work out a fair price for a piece, from your hours, your materials and its size.",
    },
    inventory: { fr: "Inventaire et collections", en: "Inventory & Collections" },
    inventoryDesc: {
      fr: "Vos œuvres en une liste — ce que vous avez fait, où cela se trouve, et ce que cela vaut.",
      en: "Your artworks in one list — what you made, where it is, and what it is worth.",
    },
    contacts: { fr: "Contacts", en: "Contacts" },
    contactsDesc: {
      fr: "Collectionneurs, commissaires, galeries et conseillers — qui ils sont et comment les joindre.",
      en: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
    },
    presentSell: { fr: "Présenter et vendre", en: "Present & Sell" },
    presentSellDesc: {
      fr: "Vos salles publiées comme salles de présentation — partagez-les, suivez les visites, relancez.",
      en: "Your published rooms as viewing rooms — share them, track visits, follow up.",
    },
    documents: { fr: "Documents", en: "Documents" },
    documentsDesc: {
      fr: "Certificats d'authenticité, étiquettes et fiches d'œuvres, prêts à imprimer.",
      en: "Certificates of authenticity, labels and artwork sheets, ready to print.",
    },
    frameStudio: { fr: "Atelier cadres", en: "Frame Studio" },
    frameStudioDesc: {
      fr: "Encadrez vos œuvres — 28 styles numérisés, largeur, profondeur, matériau et verre personnalisés, et comparaison côte à côte.",
      en: "Frame your artworks — 28 digitised styles, custom width, depth, material and glass, and side-by-side comparison.",
    },
    mockupStudio: { fr: "Atelier maquettes", en: "Mockup Studio" },
    mockupStudioDesc: {
      fr: "Voyez votre travail sur un vrai mur avant de l'accrocher — intérieurs, cadres, éclairage et exports prêts à imprimer.",
      en: "See your work on a real wall before you hang it — interiors, frames, lighting and print-ready exports.",
    },
    photographyLab: { fr: "Laboratoire photo", en: "Photography Lab" },
    photographyLabDesc: {
      fr: "Nettoyez les photos d'œuvres — recadrage, redressement, correction de la lumière et des couleurs, et exports prêts à imprimer.",
      en: "Clean up artwork photos — crop, straighten, correct light and colour, and export print-ready files.",
    },
    colorIntelligence: { fr: "Intelligence des couleurs", en: "Color Intelligence" },
    colorIntelligenceDesc: {
      fr: "Lisez les couleurs d'une œuvre — palettes, harmonies et contrastes — et trouvez le mur qu'il lui faut.",
      en: "Read the colours in a work — palettes, harmonies and contrast — and find the right wall for it.",
    },
    presentationDesigner: { fr: "Créateur de présentations", en: "Presentation Designer" },
    presentationDesignerDesc: {
      fr: "Construisez une présentation pour un acheteur, une galerie ou un jury — des diapositives à partir de vos propres œuvres, prêtes à partager.",
      en: "Build a presentation for a buyer, a gallery or a jury — slides from your own artworks, ready to share.",
    },
    collectionManager: { fr: "Gestionnaire de collection", en: "Collection Manager" },
    collectionManagerDesc: {
      fr: "Toute votre collection au même endroit — provenance, numéros d'inventaire, état et disponibilité, avec recherche et actions groupées.",
      en: "Your whole collection in one place — provenance, inventory numbers, condition and availability, with search and bulk actions.",
    },
    exhibitionPlanner: { fr: "Planificateur d'exposition", en: "Exhibition Planner" },
    exhibitionPlannerDesc: {
      fr: "Planifiez une exposition de bout en bout — concept, œuvres, salles, cartels, liste de contrôle, équipe et plan imprimable.",
      en: "Plan an exhibition end to end — concept, works, rooms, wall labels, checklist, team and a printable plan.",
    },
    visitorAnalytics: { fr: "Analytique des visiteurs", en: "Visitor Analytics" },
    visitorAnalyticsDesc: {
      fr: "Voyez qui visite vos expositions, jour après jour — œuvres les plus vues, appareils, sources, tout en anonyme.",
      en: "See who visits your exhibitions, day by day — most viewed works, devices, sources, all anonymous.",
    },
    accessibilityStudio: { fr: "Studio accessibilité et audioguide", en: "Accessibility & Audio Guide Studio" },
    accessibilityStudioDesc: {
      fr: "Descriptions audio, narration et transcriptions en anglais et en français, pour que chacun puisse vivre vos expositions.",
      en: "Audio descriptions, narration and transcripts in English and French, so everyone can experience your work.",
    },
    educationStudio: { fr: "Studio d'éducation artistique", en: "Art Education Studio" },
    educationStudioDesc: {
      fr: "Guides pédagogiques, questions et quiz pour vos expositions — pensés pour les écoles, les familles et les visiteurs curieux.",
      en: "Learning guides, questions and quizzes for your exhibitions — built for schools, families and curious visitors.",
    },
    aiArchitect: { fr: "Architecte d'exposition IA", en: "AI Exhibition Architect" },
    aiArchitectDesc: {
      fr: "Concepts, dispositions, modèles, éclairage et parcours visiteurs — des suggestions à partir de vos propres œuvres, modifiables à tout moment.",
      en: "Concepts, arrangements, templates, lighting and visitor journeys — suggestions from your own works, editable throughout.",
    },
    artworkIntelligence: { fr: "Intelligence des œuvres", en: "Artwork Intelligence" },
    artworkIntelligenceDesc: {
      fr: "Brouillons de métadonnées, étiquettes, couleurs et descriptions pour vos œuvres — toujours un brouillon à vérifier avant usage.",
      en: "Draft metadata, tags, colours and descriptions for your artworks — always a draft you check before use.",
    },
    aiAssistant: { fr: "Assistant créatif IA", en: "AI Creative Assistant" },
    aiAssistantDesc: {
      fr: "Posez des questions sur vos propres projets — ce qui convient, ce qui manque, quoi encadrer ensuite — avec des réponses tirées de vos vraies données.",
      en: "Ask about your own projects — what fits, what is missing, what to frame next — answered from your real data.",
    },
    imageTo3d: { fr: "Image vers 3D et bibliothèque", en: "Image-to-3D & Asset Library" },
    imageTo3dDesc: {
      fr: "Importez des modèles GLB, prévisualisez-les en 3D, et gardez une bibliothèque de ressources et de références sous licence.",
      en: "Import GLB models, preview them in 3D, and keep a library of licensed assets and references.",
    },
    videoGenerator: { fr: "Générateur de vidéo d'exposition", en: "Exhibition Video Generator" },
    videoGeneratorDesc: {
      fr: "Transformez une exposition en vidéo de visite — plans, titres et formats, enregistrés depuis votre vraie salle 3D.",
      en: "Turn an exhibition into a walkthrough video — shots, titles and formats, recorded from your real 3D room.",
    },
    websiteBuilder: { fr: "Créateur de site d'artiste", en: "Artist Website Builder" },
    websiteBuilderDesc: {
      fr: "Un site portfolio avec l'éditeur visuel avancé — 11 modèles, plusieurs pages, 18 blocs, glisser-déposer et page publique.",
      en: "A portfolio site with the advanced visual editor — 11 templates, multiple pages, 18 blocks, drag-and-drop and a public page.",
    },
    marketingStudio: { fr: "Studio marketing", en: "Marketing Studio" },
    marketingStudioDesc: {
      fr: "Affiches, visuels pour réseaux sociaux, invitations et dossiers de presse à partir de vos expositions, prêts à exporter.",
      en: "Posters, social graphics, invitations and press kits from your exhibitions, ready to export.",
    },
    printStudio: { fr: "Studio d'impression", en: "Print Production Studio" },
    printStudioDesc: {
      fr: "Impression prête pour la production : dimensions, fonds perdus, marges et contrôles honnêtes de résolution, avec PDF.",
      en: "Production-ready print: dimensions, bleed, margins and honest resolution checks, with PDFs.",
    },
    portfolioPdf: { fr: "Portfolio PDF", en: "Portfolio PDF Builder" },
    portfolioPdfDesc: {
      fr: "Un éditeur de design complet : modèles, textes, formes, images et vos œuvres — exportez en vrai PDF vectoriel, JPG ou PNG haute résolution.",
      en: "A full design editor: templates, text, shapes, images and your own works — export a real vector PDF, or high-resolution JPG/PNG.",
    },
    marketplace: { fr: "Place de marché", en: "Marketplace" },
    marketplaceDesc: {
      fr: "Mettez en vente originaux, éditions et tirages — parcourez les annonces et répondez aux demandes des acheteurs.",
      en: "List originals, editions and prints for sale — browse listings and answer buyer inquiries.",
    },
    teams: { fr: "Équipes et collaboration", en: "Teams & Collaboration" },
    teamsDesc: {
      fr: "Travaillez sur des expositions ensemble — projets partagés, commentaires, relectures et journal d'activité.",
      en: "Work on exhibitions together — shared projects, comments, reviews and an activity log.",
    },
    digitalTwin: { fr: "Jumeau numérique, VR et AR", en: "Digital Twin, VR & AR" },
    digitalTwinDesc: {
      fr: "Un jumeau mesuré d'une vraie salle, des visites en VR et des aperçus en RA de votre œuvre sur un vrai mur.",
      en: "A measured twin of a real room, VR walkthroughs and AR previews of your work on a real wall.",
    },
    forArtists: { fr: "Pour les artistes", en: "For Artists" },
    forArtistsDesc: {
      fr: "Gérez votre atelier depuis un seul endroit : inventaire, tarifs, ventes et documents.",
      en: "Run your studio from one place: inventory, pricing, sales and documents.",
    },
    forCurators: { fr: "Pour les commissaires", en: "For Curators" },
    forCuratorsDesc: {
      fr: "Construisez des expositions, et gardez les œuvres et les personnes autour en ordre.",
      en: "Build exhibitions, and keep the works and the people around them in order.",
    },
    forGalleries: { fr: "Pour les galeries", en: "For Galleries" },
    forGalleriesDesc: {
      fr: "Œuvres, collectionneurs, expositions et ventes sur une seule plateforme.",
      en: "Artworks, collectors, exhibitions and sales in one platform.",
    },
    forCollectors: { fr: "Pour les collectionneurs", en: "For Collectors" },
    forCollectorsDesc: {
      fr: "Suivez ce que vous possédez, ce que cela vaut, et d'où cela vient.",
      en: "Keep track of what you own, what it is worth, and where it came from.",
    },
  },
  // Hub pages (Discover, Create, Spatial Lab, Manage, Publish,
  // Intelligence, My Studio) — hub descriptions and card copy.
  hubs: {
    discoverDesc: {
      fr: "Trouvez des expositions à parcourir, des salles de galerie où construire, et l'accueil public de la plateforme.",
      en: "Find exhibitions to walk through, gallery rooms to build in, and the public home of the platform.",
    },
    createDesc: {
      fr: "Tout pour créer une exposition : vos expositions, l'éditeur 3D et les outils qui vont avec.",
      en: "Everything for making an exhibition: your exhibitions, the 3D editor, and the tools that go with them.",
    },
    spatialLabDesc: {
      fr: "Le côté 3D du studio : modèles de salles de galerie, l'éditeur où les expositions prennent forme, et les jumeaux numériques avec VR et AR.",
      en: "The 3D side of the studio: gallery room templates, the editor where exhibitions take shape, and digital twins with VR and AR.",
    },
    manageDesc: {
      fr: "La gestion de votre pratique : inventaire, collections, planification d'expositions, accessibilité, éducation, contacts, certificats et — pour le propriétaire — les statistiques de la plateforme.",
      en: "The running of your practice: inventory, collections, exhibition planning, accessibility, education, contacts, certificates, and — for the owner — platform stats.",
    },
    publishDesc: {
      fr: "Mettez votre travail devant les gens : salles de présentation, sites portfolio, marketing, impression et place de marché.",
      en: "Put your work in front of people: viewing rooms, portfolio sites, marketing, print and the marketplace.",
    },
    intelligenceDesc: {
      fr: "Ce que disent les chiffres, et une aide pour réfléchir : analytique des visiteurs, planification d'expositions assistée par IA, analyse des œuvres, ressources 3D et vidéo.",
      en: "What the numbers say, and help thinking: visitor analytics, AI-assisted exhibition planning, artwork analysis, 3D assets and video.",
    },
    studioDesc: {
      fr: "Votre espace sur Lakisa : le tableau de bord, vos expositions et vos paramètres.",
      en: "Your space on Lakisa: the dashboard, your exhibitions, and your settings.",
    },
    open: { fr: "Ouvrir", en: "Open" },
    inDevelopment: { fr: "En développement", en: "In development" },
    ownerOnly: { fr: "Réservé au propriétaire", en: "Owner only" },
    exploreExhibitions: { fr: "Explorer les expositions", en: "Explore exhibitions" },
    exploreExhibitionsDesc: {
      fr: "Parcourez les expositions publiques d'autres artistes, commissaires et galeries.",
      en: "Walk through public exhibitions by other artists, curators and galleries.",
    },
    galleryTemplates: { fr: "Modèles de galeries", en: "Gallery templates" },
    galleryTemplatesDesc: {
      fr: "Quarante salles pour commencer — choisissez-en une, ouvrez-la dans l'éditeur, faites-en la vôtre.",
      en: "Forty rooms to start from — pick one, open it in the editor, make it yours.",
    },
    publicHome: { fr: "Accueil public", en: "Public home" },
    publicHomeDesc: {
      fr: "La porte d'entrée de Lakisa — les plus récentes expositions publiques, ouvertes à tous.",
      en: "The front door of Lakisa — the newest public exhibitions, open to everyone.",
    },
    searchAll: { fr: "Rechercher toutes les expositions", en: "Search all exhibitions" },
    searchAllDesc: {
      fr: "Recherchez chaque exposition publique de la plateforme par titre, artiste ou œuvre.",
      en: "Search every public exhibition on the platform by title, artist or work.",
    },
    artInContext: { fr: "L'art en contexte", en: "Art in Context" },
    artInContextDesc: {
      fr: "Un parcours guidé de la mise en ligne à la promotion — photographie, couleur, cadres, maquettes, galerie 3D, publication et export, sur les mêmes œuvres.",
      en: "One guided path from upload to promotion — photography, colour, frames, mockups, the 3D gallery, publication and export, all on the same artworks.",
    },
    myExhibitions: { fr: "Mes expositions", en: "My exhibitions" },
    myExhibitionsDesc: {
      fr: "Toutes vos expositions en une liste — ouvrez-en une pour continuer à la construire, ou commencez-en une nouvelle.",
      en: "All your exhibitions in one list — open one to keep building it, or start a new one.",
    },
    editor3d: { fr: "Éditeur 3D", en: "3D editor" },
    editor3dDesc: {
      fr: "Placez les œuvres sur les murs, façonnez les salles, réglez la lumière — depuis votre liste d'expositions.",
      en: "Place artworks on the walls, shape the rooms, set the light — from your exhibitions list.",
    },
    toolsShort: { fr: "Outils", en: "Tools" },
    toolsShortDesc: {
      fr: "Tarifez une œuvre, tenez votre inventaire, connaissez vos contacts, présentez et vendez.",
      en: "Price a work, keep your inventory, know your contacts, present and sell.",
    },
    priceYourWork: { fr: "Tarifer mon travail", en: "Price your work" },
    priceYourWorkDesc: {
      fr: "Calculez un prix juste pour une pièce, à partir de vos heures, de vos matériaux et de sa taille.",
      en: "Work out a fair price for a piece, from your hours, your materials and its size.",
    },
    frameStudio: { fr: "Atelier cadres", en: "Frame Studio" },
    frameStudioDesc: {
      fr: "Des cadres pour vos œuvres — 28 styles numérisés, contrôles et préréglages personnalisés, et comparaison côte à côte.",
      en: "Frames for your artworks — 28 digitised styles, custom controls and presets, and side-by-side comparison.",
    },
    mockupStudio: { fr: "Atelier maquettes", en: "Mockup Studio" },
    mockupStudioDesc: {
      fr: "Voyez votre travail sur un vrai mur avant de l'accrocher — intérieurs, cadres, éclairage et exports prêts à imprimer.",
      en: "See your work on a real wall before you hang it — interiors, frames, lighting and print-ready exports.",
    },
    photographyLab: { fr: "Laboratoire photo", en: "Photography Lab" },
    photographyLabDesc: {
      fr: "Nettoyez les photos d'œuvres — recadrage, redressement, correction de la lumière et des couleurs, et exports prêts à imprimer.",
      en: "Clean up artwork photos — crop, straighten, correct light and colour, and export print-ready files.",
    },
    colorIntelligence: { fr: "Intelligence des couleurs", en: "Color Intelligence" },
    colorIntelligenceDesc: {
      fr: "Lisez les couleurs d'une œuvre — palettes, harmonies et contrastes — et trouvez le mur qu'il lui faut.",
      en: "Read the colours in a work — palettes, harmonies and contrast — and find the right wall for it.",
    },
    presentationDesigner: { fr: "Créateur de présentations", en: "Presentation Designer" },
    presentationDesignerDesc: {
      fr: "Construisez une présentation pour un acheteur, une galerie ou un jury — des diapositives à partir de vos propres œuvres, prêtes à partager.",
      en: "Build a presentation for a buyer, a gallery or a jury — slides from your own artworks, ready to share.",
    },
    inventory: { fr: "Inventaire et collections", en: "Inventory & Collections" },
    inventoryDesc: {
      fr: "Vos œuvres en une liste — ce que vous avez fait, où cela se trouve, et ce que cela vaut.",
      en: "Your artworks in one list — what you made, where it is, and what it is worth.",
    },
    collectionManager: { fr: "Gestionnaire de collection", en: "Collection Manager" },
    collectionManagerDesc: {
      fr: "Toute votre collection au même endroit — provenance, numéros d'inventaire, état et disponibilité, avec recherche et actions groupées.",
      en: "Your whole collection in one place — provenance, inventory numbers, condition and availability, with search and bulk actions.",
    },
    exhibitionPlanner: { fr: "Planificateur d'exposition", en: "Exhibition Planner" },
    exhibitionPlannerDesc: {
      fr: "Planifiez une exposition de bout en bout — concept, œuvres, salles, cartels, liste de contrôle, équipe et plan imprimable.",
      en: "Plan an exhibition end to end — concept, works, rooms, wall labels, checklist, team and a printable plan.",
    },
    accessibilityStudio: { fr: "Studio accessibilité et audioguide", en: "Accessibility & Audio Guide Studio" },
    accessibilityStudioDesc: {
      fr: "Descriptions audio, narration et transcriptions en anglais et en français, pour que chacun puisse vivre vos expositions.",
      en: "Audio descriptions, narration and transcripts in English and French, so everyone can experience your work.",
    },
    educationStudio: { fr: "Studio d'éducation artistique", en: "Art Education Studio" },
    educationStudioDesc: {
      fr: "Guides pédagogiques, questions et quiz pour vos expositions — pensés pour les écoles, les familles et les visiteurs curieux.",
      en: "Learning guides, questions and quizzes for your exhibitions — built for schools, families and curious visitors.",
    },
    teams: { fr: "Équipes et collaboration", en: "Teams & Collaboration" },
    teamsDesc: {
      fr: "Travaillez sur des expositions ensemble — projets partagés, commentaires, relectures et journal d'activité.",
      en: "Work on exhibitions together — shared projects, comments, reviews and an activity log.",
    },
    contacts: { fr: "Contacts", en: "Contacts" },
    contactsDesc: {
      fr: "Collectionneurs, commissaires, galeries et conseillers — qui ils sont et comment les joindre.",
      en: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
    },
    certificates: { fr: "Certificats", en: "Certificates" },
    certificatesDesc: {
      fr: "Certificats d'authenticité, étiquettes et fiches d'œuvres, prêts à imprimer.",
      en: "Certificates of authenticity, labels and artwork sheets, ready to print.",
    },
    adminStats: { fr: "Statistiques admin", en: "Admin stats" },
    adminStatsDesc: {
      fr: "Utilisateurs, expositions, œuvres, visites et utilisation des outils sur toute la plateforme.",
      en: "Users, exhibitions, artworks, visits and tool use across the platform.",
    },
    presentSell: { fr: "Présenter et vendre", en: "Present & Sell" },
    presentSellDesc: {
      fr: "Vos salles publiées comme salles de présentation — partagez-les, suivez les visites, relancez.",
      en: "Your published rooms as viewing rooms — share them, track visits, follow up.",
    },
    publishedExhibitions: { fr: "Expositions publiées", en: "Published exhibitions" },
    publishedExhibitionsDesc: {
      fr: "Voyez les expositions publiées en direct, comme les visiteurs les voient — y compris les vôtres.",
      en: "See published exhibitions live, the way visitors see them — including your own.",
    },
    websiteBuilder: { fr: "Créateur de site d'artiste", en: "Artist Website Builder" },
    websiteBuilderDesc: {
      fr: "Un site portfolio avec l'éditeur visuel avancé — 11 modèles, plusieurs pages, 18 blocs, glisser-déposer et page publique.",
      en: "A portfolio site with the advanced visual editor — 11 templates, multiple pages, 18 blocks, drag-and-drop and a public page.",
    },
    marketingStudio: { fr: "Studio marketing", en: "Marketing Studio" },
    marketingStudioDesc: {
      fr: "Affiches, visuels pour réseaux sociaux, invitations et dossiers de presse à partir de vos expositions, prêts à exporter.",
      en: "Posters, social graphics, invitations and press kits from your exhibitions, ready to export.",
    },
    printStudio: { fr: "Studio d'impression", en: "Print Production Studio" },
    printStudioDesc: {
      fr: "Impression prête pour la production : dimensions, fonds perdus, marges et contrôles honnêtes de résolution, avec PDF.",
      en: "Production-ready print: dimensions, bleed, margins and honest resolution checks, with PDFs.",
    },
    portfolioPdf: { fr: "Portfolio PDF", en: "Portfolio PDF Builder" },
    portfolioPdfDesc: {
      fr: "Un éditeur de design complet : modèles, textes, formes, images et vos œuvres — exportez en vrai PDF vectoriel, JPG ou PNG haute résolution.",
      en: "A full design editor: templates, text, shapes, images and your own works — export a real vector PDF, or high-resolution JPG/PNG.",
    },
    marketplace: { fr: "Place de marché", en: "Marketplace" },
    marketplaceDesc: {
      fr: "Mettez en vente originaux, éditions et tirages — parcourez les annonces et répondez aux demandes des acheteurs.",
      en: "List originals, editions and prints for sale — browse listings and answer buyer inquiries.",
    },
    insights: { fr: "Aperçus de vos expositions", en: "Your exhibition insights" },
    insightsDesc: {
      fr: "Visites, salles et œuvres populaires de vos propres expositions, au même endroit.",
      en: "Visits, popular rooms and artworks for your own exhibitions, in one place.",
    },
    aiArchitect: { fr: "Architecte d'exposition IA", en: "AI Exhibition Architect" },
    aiArchitectDesc: {
      fr: "Concepts, dispositions, modèles, éclairage et parcours visiteurs — des suggestions à partir de vos propres œuvres, modifiables à tout moment.",
      en: "Concepts, arrangements, templates, lighting and visitor journeys — suggestions from your own works, editable throughout.",
    },
    artworkIntelligence: { fr: "Intelligence des œuvres", en: "Artwork Intelligence" },
    artworkIntelligenceDesc: {
      fr: "Brouillons de métadonnées, étiquettes, couleurs et descriptions pour vos œuvres — toujours un brouillon à vérifier avant usage.",
      en: "Draft metadata, tags, colours and descriptions for your artworks — always a draft you check before use.",
    },
    aiAssistant: { fr: "Assistant créatif IA", en: "AI Creative Assistant" },
    aiAssistantDesc: {
      fr: "Posez des questions sur vos propres projets — ce qui convient, ce qui manque, quoi encadrer ensuite — avec des réponses tirées de vos vraies données.",
      en: "Ask about your own projects — what fits, what is missing, what to frame next — answered from your real data.",
    },
    imageTo3d: { fr: "Image vers 3D et bibliothèque", en: "Image-to-3D & Asset Library" },
    imageTo3dDesc: {
      fr: "Importez des modèles GLB, prévisualisez-les en 3D, et gardez une bibliothèque de ressources et de références sous licence.",
      en: "Import GLB models, preview them in 3D, and keep a library of licensed assets and references.",
    },
    videoGenerator: { fr: "Générateur de vidéo d'exposition", en: "Exhibition Video Generator" },
    videoGeneratorDesc: {
      fr: "Transformez une exposition en vidéo de visite — plans, titres et formats, enregistrés depuis votre vraie salle 3D.",
      en: "Turn an exhibition into a walkthrough video — shots, titles and formats, recorded from your real 3D room.",
    },
    digitalTwin: { fr: "Jumeau numérique, VR et AR", en: "Digital Twin, VR & AR" },
    digitalTwinDesc: {
      fr: "Un jumeau mesuré d'une vraie salle, des visites en VR et des aperçus en RA de votre œuvre sur un vrai mur.",
      en: "A measured twin of a real room, VR walkthroughs and AR previews of your work on a real wall.",
    },
    studioHome: { fr: "Mon studio — Lakisa", en: "My Studio — Lakisa" },
    studioHomeDesc: {
      fr: "Votre espace sur Lakisa : le tableau de bord, vos expositions et vos paramètres.",
      en: "Your space on Lakisa: the dashboard, your exhibitions, and your settings.",
    },
    dashboardCard: { fr: "Tableau de bord", en: "Dashboard" },
    dashboardCardDesc: {
      fr: "Vos expositions, œuvres et vues en un coup d'œil — votre espace créatif.",
      en: "Your exhibitions, artworks and views at a glance — your creative space.",
    },
    settingsCard: { fr: "Paramètres", en: "Settings" },
    settingsCardDesc: {
      fr: "Votre profil, votre thème, votre mot de passe, votre compte.",
      en: "Your profile, your theme, your password, your account.",
    },
    notifications: { fr: "Notifications", en: "Notifications" },
    notificationsDesc: {
      fr: "Nouvelles visites, nouveaux abonnés et activité des expositions, au fur et à mesure.",
      en: "New visits, new followers and exhibition activity, as they happen.",
    },
    helpCentre: { fr: "Centre d'aide", en: "Help centre" },
    helpCentreDesc: {
      fr: "Guides et réponses pour construire, publier et vendre sur Lakisa.",
      en: "Guides and answers for building, publishing and selling on Lakisa.",
    },
  },
  // Tool detail pages (app/tools/*) — page title, eyebrow and header
  // description for each tool, plus the four audience pages and their
  // points. ToolsShell renders these from keys; the four pages with a
  // live count in the eyebrow (inventory, marketplace, present-sell,
  // teams) keep passing their eyebrow as a plain string.
  toolpages: {
    toolsHub: { fr: "Outils", en: "Tools" },
    toolsHubEyebrow: {
      fr: "OUTILS POUR ARTISTES, COMMISSAIRES, GALERIES ET COLLECTIONNEURS",
      en: "TOOLS FOR ARTISTS, CURATORS, GALLERIES & COLLECTORS",
    },
    toolsHubDesc: {
      fr: "Les outils quotidiens du monde de l'art, dans votre espace de travail — tarifer une œuvre, tenir votre inventaire, connaître vos contacts, présenter et vendre, et imprimer les documents qui accompagnent une vente.",
      en: "The everyday tools of the art world, inside your workspace — price a work, keep your inventory, know your contacts, present and sell, and print the documents that go with a sale.",
    },
    seeAllTools: { fr: "Voir tous les outils", en: "See all the tools" },
    accessibility: { fr: "Studio accessibilité et audioguide", en: "Accessibility & Audio Guide Studio" },
    accessibilityEyebrow: { fr: "OUTILS · STUDIO ACCESSIBILITÉ ET AUDIOGUIDE", en: "TOOLS · ACCESSIBILITY & AUDIO GUIDE STUDIO" },
    accessibilityDesc: {
      fr: "Rendez l'exposition ouverte à chaque visiteur. Rédigez des descriptions audio, des narrations d'artiste et de commissaire, des légendes et des transcriptions — en anglais et en français — écoutez-les lues à voix haute par les voix de votre navigateur, et mesurez le dossier à une vraie liste de contrôle d'accessibilité.",
      en: "Make the exhibition open to every visitor. Write audio descriptions, artist and curator narration, captions and transcripts — in English and French — hear them read aloud with your browser's own voices, and measure the pack against a real accessibility checklist.",
    },
    aiArchitect: { fr: "Architecte d'exposition IA", en: "AI Exhibition Architect" },
    aiArchitectEyebrow: { fr: "OUTILS · ARCHITECTE D'EXPOSITION IA", en: "TOOLS · AI EXHIBITION ARCHITECT" },
    aiArchitectDesc: {
      fr: "Planifiez une exposition à partir de vos propres œuvres. Le concept, l'accrochage, le choix de la salle, l'éclairage et les couleurs des murs sont calculés à partir de vos œuvres, dimensions, couleurs et des 40 modèles de galeries — aucun modèle nécessaire. Tout ce qui demanderait un modèle de langue est clairement indiqué et reste désactivé jusqu'à ce que vous connectiez un fournisseur d'IA.",
      en: "Plan a show from your own works. The concept, hang, room match, lighting and wall colours are computed from your artworks, dimensions, colours and the 40 gallery templates — no model needed. Anything that would need a language model is clearly marked and stays off until you connect an AI provider.",
    },
    aiAssistant: { fr: "Assistant créatif IA", en: "AI Creative Assistant" },
    aiAssistantEyebrow: { fr: "OUTILS · ASSISTANT CRÉATIF IA", en: "TOOLS · AI CREATIVE ASSISTANT" },
    aiAssistantDesc: {
      fr: "Posez des questions sur votre projet et obtenez des réponses tirées de vos vraies données — vos expositions, œuvres, salles et cadres — avec la source indiquée sous chaque réponse. Quand une question ne peut pas être répondue à partir des données et des règles, l'assistant le dit au lieu de deviner.",
      en: "Ask about your project and get answers from your real data — your exhibitions, artworks, rooms and frames — with the source shown under every answer. When a question cannot be answered from data and rules, the assistant says so instead of guessing.",
    },
    artInContext: { fr: "L'art en contexte", en: "Art in Context" },
    artInContextEyebrow: { fr: "OUTILS · L'ART EN CONTEXTE", en: "TOOLS · ART IN CONTEXT" },
    artInContextDesc: {
      fr: "Une œuvre, un parcours : mettez-la en ligne, photographiez-la, lisez ses couleurs, encadrez-la, accrochez-la dans une salle, disposez-la avec ses compagnes, placez-la dans la galerie 3D, publiez l'exposition — et faites-en la promotion. Chaque étape travaille sur la même fiche, donc rien n'est mis en ligne deux fois et rien ne se désynchronise.",
      en: "One artwork, one journey: upload it, photograph it, read its colours, frame it, hang it in a room, arrange it with its companions, place it in the 3D gallery, publish the show — and promote it. Every step works on the same record, so nothing is uploaded twice and nothing drifts out of sync.",
    },
    artworkIntelligence: { fr: "Intelligence des œuvres", en: "Artwork Intelligence" },
    artworkIntelligenceEyebrow: { fr: "OUTILS · INTELLIGENCE DES ŒUVRES", en: "TOOLS · ARTWORK INTELLIGENCE" },
    artworkIntelligenceDesc: {
      fr: "Que dit déjà votre œuvre d'elle-même ? Des métadonnées tirées de votre fiche, des étiquettes tirées de règles, des couleurs mesurées sur les vrais pixels, et des brouillons de descriptions construits à partir de vos propres données — chaque champ généré est un brouillon à vérifier, jamais un fait inventé.",
      en: "What does your work already say about itself? Metadata from your record, tags from rules, colours measured from the real pixels, and description drafts built from your own data — every generated field is a draft to check, never an invented fact.",
    },
    collectionManager: { fr: "Gestionnaire de collection", en: "Collection Manager" },
    collectionManagerEyebrow: { fr: "OUTILS · GESTIONNAIRE DE COLLECTION", en: "TOOLS · COLLECTION MANAGER" },
    collectionManagerDesc: {
      fr: "Chaque œuvre que vous possédez, dans toutes vos expositions, en un seul tableau. Recherchez, filtrez et triez, étiquetez les œuvres, suivez la disponibilité et l'emplacement, et gardez la provenance, les numéros d'inventaire, les constats d'état et les notes sur chaque pièce.",
      en: "Every artwork you own, across all your exhibitions, in one table. Search, filter and sort, tag works, track availability and location, and keep provenance, inventory numbers, condition reports and notes on each piece.",
    },
    colorIntelligence: { fr: "Intelligence des couleurs", en: "Color Intelligence" },
    colorIntelligenceEyebrow: { fr: "OUTILS · INTELLIGENCE DES COULEURS", en: "TOOLS · COLOR INTELLIGENCE" },
    colorIntelligenceDesc: {
      fr: "Quelles couleurs vivent vraiment dans votre œuvre ? Choisissez une de vos œuvres — ou mettez une image en ligne — et lisez sa vraie palette : couleurs dominantes, harmonies, contrastes et les couleurs de mur qui la présentent le mieux.",
      en: "What colours actually live in your work? Pick one of your artworks — or upload an image — and read its real palette: dominant colours, harmonies, contrast and the wall colours that present it best.",
    },
    contacts: { fr: "Contacts", en: "Contacts" },
    contactsEyebrow: { fr: "OUTILS · CONTACTS ET RELATIONS", en: "TOOLS · CONTACTS & RELATIONSHIPS" },
    contactsDesc: {
      fr: "Les gens autour de votre œuvre — collectionneurs, commissaires, galeries, conseillers. Gardez-les au même endroit, avec une note sur la façon dont vous vous êtes rencontrés et ce qui leur tient à cœur.",
      en: "The people around your work — collectors, curators, galleries, advisors. Keep them in one place, with a note on how you met and what they care about.",
    },
    digitalTwin: { fr: "Jumeau numérique, VR et AR", en: "Digital Twin, VR & AR" },
    digitalTwinEyebrow: { fr: "OUTILS · JUMEAU NUMÉRIQUE", en: "TOOLS · DIGITAL TWIN" },
    digitalTwinDesc: {
      fr: "Mesurez une vraie salle une fois et gardez son jumeau numérique : dimensions exactes, finitions des murs et du sol, portes, fenêtres et l'emplacement de chaque œuvre. Comparez le plan au mètre ruban, obtenez un ordre d'installation, parcourez la salle en VR, et prévisualisez une œuvre sur votre propre mur en RA — ou sur une photo de celui-ci quand la RA n'est pas disponible.",
      en: "Measure a real room once and keep its digital twin: exact dimensions, wall and floor finishes, doors, windows and where each work hangs. Compare the plan against the tape measure, get an installation order, walk the room in VR, and preview a work on your own wall in AR — or on a photo of it when AR is not available.",
    },
    documents: { fr: "Documents", en: "Documents" },
    documentsEyebrow: { fr: "OUTILS · DOCUMENTS ET RAPPORTS", en: "TOOLS · DOCUMENTS & REPORTING" },
    documentsDesc: {
      fr: "Le papier qui accompagne une vente. Créez un certificat d'authenticité dans le studio — détails modifiables, dix modèles originaux, un QR code pour la vérification — puis délivrez-le, réimprimez-le ou révoquez-le. Chaque certificat est enregistré dans votre compte et dans la base de données, avec une copie archivée dans votre espace R2 ; l'export est un vrai PDF d'une page, ou passe par la boîte de dialogue d'impression de votre navigateur.",
      en: "The paper that goes with a sale. Build a certificate of authenticity in the studio — editable details, ten original templates, a QR code for verification — then issue it, reprint it, or revoke it. Every certificate is saved in your account and in the database, with a copy archived in your R2 storage; export is a real one-page PDF, or through your browser's print dialog.",
    },
    educationStudio: { fr: "Studio d'éducation artistique", en: "Art Education Studio" },
    educationStudioEyebrow: { fr: "OUTILS · STUDIO D'ÉDUCATION ARTISTIQUE", en: "TOOLS · ART EDUCATION STUDIO" },
    educationStudioDesc: {
      fr: "Transformez une exposition en salle de classe. Rédigez des cartels adaptés aux apprenants, des guides pédagogiques structurés, des questions de commissariat avec des réponses modèles, des quiz que les visiteurs peuvent passer, des pistes d'analyse et des parcours guidés — puis imprimez le dossier ou téléchargez-le.",
      en: "Turn an exhibition into a classroom. Write learner-friendly labels, structured learning guides, curatorial questions with model answers, quizzes visitors can take, analysis prompts and guided routes — then print the pack or download it.",
    },
    exhibitionPlanner: { fr: "Planificateur d'exposition", en: "Exhibition Planner" },
    exhibitionPlannerEyebrow: { fr: "OUTILS · PLANIFICATEUR D'EXPOSITION", en: "TOOLS · EXHIBITION PLANNER" },
    exhibitionPlannerDesc: {
      fr: "Planifiez une exposition de la première idée au jour de l'installation. Choisissez vos œuvres, attribuez-les aux salles, fixez l'ordre, rédigez les cartels, et gardez la liste de contrôle et l'équipe dans un plan imprimable.",
      en: "Plan one exhibition from first idea to install day. Pick your artworks, assign them to rooms, set the sequence, write the wall labels, and keep the checklist and the team in one printable plan.",
    },
    frameStudio: { fr: "Atelier cadres", en: "Frame Studio" },
    frameStudioEyebrow: { fr: "OUTILS · ATELIER CADRES", en: "TOOLS · FRAME STUDIO" },
    frameStudioDesc: {
      fr: "Encadrez vos œuvres sans ouvrir l'éditeur 3D. Choisissez une œuvre, prévisualisez-la dans chaque style de cadre, affinez le cadre au millimètre, comparez-en jusqu'à quatre côte à côte — puis enregistrez le cadre directement sur l'œuvre.",
      en: "Frame your artworks without opening the 3D editor. Pick a work, preview it in every frame style, fine-tune the frame to the millimetre, compare up to four side by side — then save the frame straight onto the artwork.",
    },
    imageTo3d: { fr: "Image vers 3D et bibliothèque", en: "Image-to-3D & Asset Library" },
    imageTo3dEyebrow: { fr: "OUTILS · IMAGE VERS 3D", en: "TOOLS · IMAGE-TO-3D" },
    imageTo3dDesc: {
      fr: "Gardez vos ressources 3D au même endroit avec leurs licences et attributions, prévisualisez les modèles .glb importés en 3D, et transformez des images en panneaux texturés ou en reliefs — avec les limites énoncées clairement : une seule image ne peut pas reconstruire la géométrie cachée.",
      en: "Keep your 3D assets in one place with their licences and attribution, preview imported .glb models in 3D, and turn images into textured panels or depth reliefs — with the limits stated plainly: a single image cannot reconstruct hidden geometry.",
    },
    inventory: { fr: "Inventaire et collections", en: "Inventory & Collections" },
    inventoryDesc: {
      fr: "Chaque œuvre que vous avez accrochée dans une exposition, en une seule liste. Ajoutez une œuvre dans l'éditeur et elle apparaît ici.",
      en: "Every artwork you have hung in an exhibition, in one list. Add a work in the editor and it appears here.",
    },
    marketingStudio: { fr: "Studio marketing", en: "Marketing Studio" },
    marketingStudioEyebrow: { fr: "OUTILS · STUDIO MARKETING", en: "TOOLS · MARKETING STUDIO" },
    marketingStudioDesc: {
      fr: "Générez des supports marketing d'exposition à partir de vos propres œuvres et expositions — affiches, visuels pour réseaux sociaux, cartons d'invitation, dossiers de presse et annonces. Choisissez un modèle, fixez les couleurs de votre marque, prévisualisez en direct, et exportez aux vraies tailles en pixels.",
      en: "Generate exhibition marketing assets from your own artworks and exhibitions — posters, social graphics, invitation cards, press kits and announcements. Pick a template, set your brand colours, preview live, and export at real pixel sizes.",
    },
    marketplace: { fr: "Place de marché", en: "Marketplace" },
    marketplaceDesc: {
      fr: "Mettez une œuvre en vente, fixez son prix, et parlez à l'acheteur qui vous écrit. La demande est le chemin de la vente — un visiteur écrit, vous répondez par e-mail, et vous convenez de la vente directement. Aucun paiement n'est encore pris sur Lakisa.",
      en: "Put a work up for sale, set its price, and talk to the buyer who asks about it. The inquiry is the sale path — a visitor writes, you reply by email, and you agree the sale directly. No payment is taken on Lakisa yet.",
    },
    mockupStudio: { fr: "Atelier maquettes", en: "Mockup Studio" },
    mockupStudioEyebrow: { fr: "OUTILS · ATELIER MAQUETTES", en: "TOOLS · MOCKUP STUDIO" },
    mockupStudioDesc: {
      fr: "Accrochez votre œuvre sur un vrai mur avant même qu'elle quitte l'atelier. Choisissez une œuvre, choisissez une salle, réglez le cadre et la lumière — puis exportez une maquette prête à imprimer à envoyer à un acheteur ou une galerie.",
      en: "Hang your work on a real wall before it ever leaves the studio. Pick an artwork, choose a room, set the frame and the light — then export a print-ready mockup to send to a buyer or a gallery.",
    },
    photographyLab: { fr: "Laboratoire photo", en: "Photography Lab" },
    photographyLabEyebrow: { fr: "OUTILS · LABORATOIRE PHOTO", en: "TOOLS · PHOTOGRAPHY LAB" },
    photographyLabDesc: {
      fr: "Redressez une photo de travers, recadrez au bord du papier, corrigez la lumière — et exportez un fichier propre pour votre catalogue ou un jury. Rien ici ne touche votre photo originale : chaque modification est un réglage, appliqué seulement à l'export.",
      en: "Straighten a crooked shot, crop to the paper's edge, fix the light — and export a clean file for your catalogue or a jury. Nothing here touches your original photo: every edit is a setting, applied only when you export.",
    },
    presentSell: { fr: "Présenter et vendre", en: "Present & Sell" },
    presentSellDesc: {
      fr: "Une exposition publiée est déjà une salle de présentation : un lien, les œuvres au mur, le visiteur la parcourt. Partagez le lien, suivez les visites, relancez pendant que l'œuvre est encore fraîche dans leur esprit.",
      en: "A published exhibition is already a viewing room: one link, the works on the wall, the visitor walks through it. Share the link, watch the visits, follow up while the work is still fresh in their mind.",
    },
    presentationDesigner: { fr: "Créateur de présentations", en: "Presentation Designer" },
    presentationDesignerEyebrow: { fr: "OUTILS · CRÉATEUR DE PRÉSENTATIONS", en: "TOOLS · PRESENTATION DESIGNER" },
    presentationDesignerDesc: {
      fr: "Transformez vos œuvres en une présentation qu'une galerie, un jury ou une foire peut ouvrir et comprendre en quelques minutes — une page de titre, vos œuvres avec légendes, votre biographie et votre projet, exportés en PDF.",
      en: "Turn your artworks into a presentation a gallery, a jury or a fair can open and understand in minutes — a title page, your works with captions, your biography and your project, exported as a PDF.",
    },
    priceYourWork: { fr: "Tarifer mon travail", en: "Price your work" },
    priceYourWorkEyebrow: { fr: "OUTILS · TARIFER MON TRAVAIL", en: "TOOLS · PRICE YOUR WORK" },
    priceYourWorkDesc: {
      fr: "Combien cette pièce devrait-elle se vendre ? Partez de ce qu'elle vous a coûté — vos heures et vos matériaux — et laissez le calculateur suggérer une fourchette. Tous les prix en dollars américains, affichés aussi en euros, livres, francs suisses et shillings ougandais, aux taux de change du jour.",
      en: "What should this piece sell for? Start from what it cost you — your hours and your materials — and let the calculator suggest a range. All prices in US dollars, shown in euros, pounds, Swiss francs and Ugandan shillings too, at the day's exchange rates.",
    },
    printStudio: { fr: "Studio d'impression", en: "Print Production Studio" },
    printStudioEyebrow: { fr: "OUTILS · STUDIO D'IMPRESSION", en: "TOOLS · PRINT STUDIO" },
    printStudioDesc: {
      fr: "Des supports prêts pour la production à partir de vos propres œuvres — affiches, cartels, pages de catalogue et certificats. Vraies dimensions d'impression, fonds perdus et marges de sécurité, un contrôle DPI calculé à partir des pixels réels de l'image, et un PDF de production avec traits de coupe.",
      en: "Production-ready materials from your own artworks — posters, wall labels, catalogue pages and certificates. Real print dimensions, bleed and safe margins, a DPI check computed from the image's actual pixels, and a production PDF with crop marks.",
    },
    portfolioPdf: { fr: "Portfolio PDF", en: "Portfolio PDF Builder" },
    portfolioPdfEyebrow: { fr: "OUTILS · PORTFOLIO PDF", en: "TOOLS · PORTFOLIO PDF" },
    portfolioPdfDesc: {
      fr: "Créez affiches, publications, CV, invitations et présentations dans l’éditeur Atelier : 8 modèles originaux, textes, formes, images, calques, pages multiples — puis exportez en vrai PDF vectoriel, JPG ou PNG haute résolution.",
      en: "Create posters, posts, CVs, invitations and presentations in the Atelier editor: 8 original templates, text, shapes, images, layers, multiple pages — then export a real vector PDF, or high-resolution JPG/PNG.",
    },
    teams: { fr: "Équipes et collaboration", en: "Teams & Collaboration" },
    teamsDesc: {
      fr: "Partagez une exposition avec une équipe, parlez-en dans les commentaires, demandez une relecture et approuvez-la ensemble. Les propriétaires invitent, les éditeurs partagent et modifient, les lecteurs lisent — et chaque autorisation est vérifiée sur le serveur, pas seulement dans les boutons.",
      en: "Share an exhibition with a team, talk about it in comments, ask for a review and approve it together. Owners invite, editors share and edit, viewers read — and every permission is checked on the server, not just in the buttons.",
    },
    videoGenerator: { fr: "Générateur de vidéo d'exposition", en: "Exhibition Video Generator" },
    videoGeneratorEyebrow: { fr: "OUTILS · GÉNÉRATEUR DE VIDÉO", en: "TOOLS · VIDEO GENERATOR" },
    videoGeneratorDesc: {
      fr: "Transformez une exposition en vidéo pour Reels, votre fil ou YouTube : définissez les plans — marches de caméra, gros plans sur les œuvres, cartons de titre et de texte — puis enregistrez la vraie salle 3D dans votre navigateur. Pas de ferme de rendu : la vidéo est capturée en direct, en temps réel, et téléchargée en fichier .webm.",
      en: "Turn an exhibition into a video for Reels, your feed or YouTube: define the shots — camera walks, artwork close-ups, title and statement cards — then record the real 3D room in your browser. No render farm: the video is captured live, in real time, and downloaded as a .webm file.",
    },
    visitorAnalytics: { fr: "Analytique des visiteurs", en: "Visitor Analytics" },
    visitorAnalyticsEyebrow: { fr: "OUTILS · ANALYTIQUE DES VISITEURS", en: "TOOLS · VISITOR ANALYTICS" },
    visitorAnalyticsDesc: {
      fr: "Qui visite vos expositions : visites dans le temps, visiteurs uniques, œuvres les plus vues, appareils, sources de trafic et pays — des comptes anonymes uniquement, aucune donnée personnelle.",
      en: "Who visits your exhibitions: visits over time, unique visitors, most viewed artworks, devices, traffic sources and countries — anonymous counts only, no personal data.",
    },
    websiteBuilder: { fr: "Créateur de site d'artiste", en: "Artist Website Builder" },
    websiteBuilderEyebrow: { fr: "OUTILS · CRÉATEUR DE SITE", en: "TOOLS · WEBSITE BUILDER" },
    websiteBuilderDesc: {
      fr: "Créez un site portfolio avec l'éditeur visuel avancé : 11 modèles, plusieurs pages, 18 blocs en glisser-déposer, thème et SEO — puis publiez-le comme une vraie page publique que toute personne avec le lien peut ouvrir.",
      en: "Build a portfolio site with the advanced visual editor: 11 templates, multiple pages, 18 drag-and-drop blocks, theme and SEO — then publish it as a real public page anyone with the link can open.",
    },
    forArtists: { fr: "Pour les artistes", en: "For Artists" },
    forArtistsEyebrow: { fr: "OUTILS · POUR LES ARTISTES", en: "TOOLS · FOR ARTISTS" },
    forArtistsDesc: {
      fr: "Votre atelier, géré depuis un seul endroit. Accrochez l'œuvre, tarifez-la, sachez qui la regarde, et envoyez les documents qui accompagnent une vente.",
      en: "Your studio, run from one place. Hang the work, price it, know who is looking at it, and send the documents that go with a sale.",
    },
    forArtistsP1h: { fr: "Inventaire de l'atelier", en: "Studio inventory" },
    forArtistsP1t: {
      fr: "Chaque œuvre que vous créez, listée avec sa technique, sa taille et son emplacement — dans une exposition, à l'atelier, ou vendue.",
      en: "Every work you make, listed with its medium, its size and where it is — in a show, in the studio, or sold.",
    },
    forArtistsP2h: { fr: "Tarifer mon travail", en: "Price your work" },
    forArtistsP2t: {
      fr: "Partez de vos heures et de vos matériaux, et obtenez une fourchette que vous pouvez défendre quand un collectionneur demande.",
      en: "Start from your hours and your materials, and get a range you can stand behind when a collector asks.",
    },
    forArtistsP3h: { fr: "Des expositions qui voyagent", en: "Exhibitions that travel" },
    forArtistsP3t: {
      fr: "Construisez une salle, accrochez l'œuvre à sa vraie taille, publiez-la — un collectionneur n'importe où dans le monde la parcourt.",
      en: "Build a room, hang the work at its real size, publish it — a collector anywhere in the world walks through it.",
    },
    forArtistsP4h: { fr: "Des documents qui suivent l'œuvre", en: "Documents that follow the work" },
    forArtistsP4t: {
      fr: "Un certificat d'authenticité pour chaque vente, imprimé à partir de l'œuvre elle-même.",
      en: "A certificate of authenticity for every sale, printed from the work itself.",
    },
    forCollectors: { fr: "Pour les collectionneurs", en: "For Collectors" },
    forCollectorsEyebrow: { fr: "OUTILS · POUR LES COLLECTIONNEURS", en: "TOOLS · FOR COLLECTORS" },
    forCollectorsDesc: {
      fr: "Ce que vous possédez, ce que cela vaut, et d'où cela vient — gardé au même endroit, avec les documents qui le prouvent.",
      en: "What you own, what it is worth, and where it came from — kept in one place, with the documents that prove it.",
    },
    forCollectorsP1h: { fr: "Votre collection, en une liste", en: "Your collection, in one list" },
    forCollectorsP1t: {
      fr: "Chaque œuvre que vous possédez, avec son artiste, sa technique, ses dimensions et son année — et l'exposition d'où elle vient.",
      en: "Every work you own, with its artist, medium, dimensions and year — and the exhibition it came from.",
    },
    forCollectorsP2h: { fr: "Provenance et documents", en: "Provenance and documents" },
    forCollectorsP2t: {
      fr: "Un certificat d'authenticité pour chaque œuvre, pour que l'histoire de la pièce voyage avec elle.",
      en: "A certificate of authenticity for each work, so the story of the piece travels with it.",
    },
    forCollectorsP3h: { fr: "Parcourez une exposition depuis chez vous", en: "Walk through a show from home" },
    forCollectorsP3t: {
      fr: "La salle de présentation d'une galerie vous permet de vous tenir devant l'œuvre avant de décider.",
      en: "A gallery's viewing room lets you stand in front of the work before you decide.",
    },
    forCollectorsP4h: { fr: "Tarifer la tête froide", en: "Price with a clear head" },
    forCollectorsP4t: {
      fr: "Voyez ce qu'une pièce a coûté à faire et ce qu'elle se vend — un prix juste est un prix que l'on comprend.",
      en: "See what a piece cost to make and what it sells for — a fair price is one you understand.",
    },
    forCurators: { fr: "Pour les commissaires", en: "For Curators" },
    forCuratorsEyebrow: { fr: "OUTILS · POUR LES COMMISSAIRES", en: "TOOLS · FOR CURATORS" },
    forCuratorsDesc: {
      fr: "Construisez l'exposition, puis gardez tout ce qui l'entoure en ordre — les œuvres, les artistes, les prêteurs et les visiteurs.",
      en: "Build the show, then keep everything around it in order — the works, the artists, the lenders and the visitors.",
    },
    forCuratorsP1h: { fr: "Construire l'exposition", en: "Build the exhibition" },
    forCuratorsP1t: {
      fr: "Choisissez une salle, accrochez les œuvres à leur vraie taille, et parcourez l'accrochage avant tout le monde.",
      en: "Choose a room, hang the works at their real size, and walk through the hang before anyone else does.",
    },
    forCuratorsP2h: { fr: "Garder les œuvres en ordre", en: "Keep the works in order" },
    forCuratorsP2t: {
      fr: "Un inventaire de tout ce qui est dans l'exposition — technique, dimensions, année, et d'où vient chaque pièce.",
      en: "An inventory of everything in the show — medium, dimensions, year, and where each piece came from.",
    },
    forCuratorsP3h: { fr: "Connaître les gens", en: "Know the people" },
    forCuratorsP3t: {
      fr: "Artistes, prêteurs, collectionneurs et conseillers dans une seule liste de contacts, avec une note sur chacun.",
      en: "Artists, lenders, collectors and advisors in one contact list, with a note on each of them.",
    },
    forCuratorsP4h: { fr: "La présenter comme une salle de présentation", en: "Present it as a viewing room" },
    forCuratorsP4t: {
      fr: "Publiez la salle et partagez un seul lien — le jury, la presse ou un collectionneur la parcourt depuis n'importe où.",
      en: "Publish the room and share one link — the jury, the press or a collector walks through it from anywhere.",
    },
    forGalleries: { fr: "Pour les galeries", en: "For Galleries" },
    forGalleriesEyebrow: { fr: "OUTILS · POUR LES GALERIES", en: "TOOLS · FOR GALLERIES" },
    forGalleriesDesc: {
      fr: "Le travail quotidien de la galerie sur une seule plateforme — les œuvres, les collectionneurs, les expositions et les ventes.",
      en: "The gallery's everyday work in one platform — the artworks, the collectors, the exhibitions and the sales.",
    },
    forGalleriesP1h: { fr: "Œuvres et inventaire", en: "Artworks and inventory" },
    forGalleriesP1t: {
      fr: "Chaque œuvre de la galerie, avec ses détails et son histoire — ce qui est au mur, ce qui est en réserve, ce qui est vendu.",
      en: "Every work in the gallery, with its details and its history — what is on the wall, what is in storage, what is sold.",
    },
    forGalleriesP2h: { fr: "Collectionneurs et relations", en: "Collectors and relationships" },
    forGalleriesP2t: {
      fr: "Qui collectionne quoi, qui est venu à quelle ouverture, et quoi relancer — gardé au même endroit.",
      en: "Who collects what, who came to which opening, and what to follow up on — kept in one place.",
    },
    forGalleriesP3h: { fr: "Les expositions comme salles de présentation", en: "Exhibitions as viewing rooms" },
    forGalleriesP3t: {
      fr: "Publiez une exposition et partagez-la comme une salle que les gens parcourent, avec les œuvres à leur vraie taille.",
      en: "Publish a show and share it as a room people walk through, with the works at their real size.",
    },
    forGalleriesP4h: { fr: "Des documents pour chaque vente", en: "Documents for every sale" },
    forGalleriesP4t: {
      fr: "Certificats d'authenticité et fiches d'œuvres, imprimés à partir de l'œuvre elle-même.",
      en: "Certificates of authenticity and artwork sheets, printed from the work itself.",
    },
  },
  // Admin panel (owner only).
  admin: {
    dashboard: { fr: "Tableau de bord", en: "Dashboard" },
    allUsers: { fr: "Tous les utilisateurs", en: "All users" },
    allExhibitions: { fr: "Toutes les expositions", en: "All exhibitions" },
    allArtworks: { fr: "Toutes les œuvres", en: "All artworks" },
    galleries: { fr: "Galeries", en: "Galleries" },
    toolsUsed: { fr: "Outils utilisés", en: "Tools used" },
    general: { fr: "Général", en: "General" },
    account: { fr: "Compte", en: "Account" },
    adminPanel: { fr: "Panneau d'administration", en: "Admin Panel" },
    search: { fr: "Rechercher", en: "Search" },
    searchMenu: { fr: "Rechercher dans le menu", en: "Search menu" },
    closeMenu: { fr: "Fermer le menu", en: "Close menu" },
    expandMenu: { fr: "Déplier le menu", en: "Expand menu" },
    collapseMenu: { fr: "Replier le menu", en: "Collapse menu" },
    noMatchingSection: { fr: "Aucune section correspondante.", en: "No matching section." },
    signOut: { fr: "Se déconnecter", en: "Sign out" },
    galleryNames: { fr: "Noms des galeries", en: "Gallery names" },
    englishName: { fr: "Nom anglais", en: "English name" },
    frenchName: { fr: "Nom français", en: "French name" },
    save: { fr: "Enregistrer", en: "Save" },
    saving: { fr: "Enregistrement…", en: "Saving…" },
    saved: { fr: "Enregistré.", en: "Saved." },
    gallery: { fr: "Galerie", en: "Gallery" },
    category: { fr: "Catégorie", en: "Category" },
    size: { fr: "Taille", en: "Size" },
    status: { fr: "Statut", en: "Status" },
    action: { fr: "Action", en: "Action" },
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

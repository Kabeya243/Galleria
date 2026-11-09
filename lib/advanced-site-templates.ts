// The 11 original template definitions of the advanced website
// builder (Claude « atelier-sites », integrated 8 Nov 2026).
// Verbatim copy of the standalone builder's src/lib/templates.ts
// (import path adapted). Designs are original, inspired by visual
// families, never copies of an existing site.
// Demo images referenced here (/images/*.jpg) are copied into
// public/images/: 8 Unsplash-licensed photos + 3 Leonardo da Vinci
// works in the public domain (Wikimedia Commons). They are placeholders
// — the artist replaces them with their own works.
import type { Block, BlockType, SiteDocument, SitePage, TemplateSection, TemplateSummary, Theme } from "@/lib/advanced-site-types";

const palettes = {
  painter: { primary: "#a74731", secondary: "#ead9c5", background: "#f6f1e8", text: "#29241f", accent: "#d9a854" },
  photo: { primary: "#d3b88a", secondary: "#282d2e", background: "#151718", text: "#f7f3e9", accent: "#d3b88a" },
  graphic: { primary: "#111111", secondary: "#f0fb39", background: "#f4efdd", text: "#111111", accent: "#ff6a3d" },
  sculpture: { primary: "#5b594c", secondary: "#e3dfd1", background: "#f4f1e9", text: "#282820", accent: "#a46e45" },
  music: { primary: "#e9a475", secondary: "#2b2027", background: "#181317", text: "#f8efe9", accent: "#e9a475" },
  writer: { primary: "#355346", secondary: "#dce5da", background: "#f4f3e9", text: "#282e29", accent: "#b58952" },
  dance: { primary: "#c17583", secondary: "#50335b", background: "#24172d", text: "#fbf3ee", accent: "#e5a0ad" },
  film: { primary: "#c28b56", secondary: "#23292a", background: "#111516", text: "#f2f1e9", accent: "#c28b56" },
  gallery: { primary: "#7c493c", secondary: "#eee2d8", background: "#fcf8f1", text: "#2f2924", accent: "#bd9b5b" },
  craft: { primary: "#526344", secondary: "#e7e4d7", background: "#f8f6ef", text: "#262c21", accent: "#b16e4b" }
};

type RawTemplate = Omit<TemplateSummary, "colors"> & {
  colors: Theme["colors"];
  sections: TemplateSection[];
  pageSections?: TemplateSection[][];
};

export const templates: RawTemplate[] = [
  {
    id: "portfolio-editorial", name: "Léonard de Vinci", siteTitle: "Leonardo da Vinci", coverImage: "/images/leonardo-self-portrait.jpg", design: "editorial", category: "Peinture & invention",
    description: "Portfolio d'atelier consacré à Léonard de Vinci, ses peintures, carnets et recherches.",
    colors: { primary: "#1d2025", secondary: "#e5e2d4", background: "#f1efdf", text: "#191b20", accent: "#87785f" },
    hero: "Leonardo da Vinci", pages: ["Accueil", "Œuvres", "Biographie", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Leonardo da Vinci", body: "Peintre, dessinateur et chercheur de la Renaissance italienne. Un regard qui relie l'art, la nature et la science.", image: "/images/leonardo-self-portrait.jpg" },
      { title: "Œuvres", type: "gallery", heading: "Œuvres et études", body: "Quelques œuvres majeures conservées et documentées à travers le monde.", items: ["La Joconde", "La Cène", "Portrait de Léonard"], images: ["/images/leonardo-mona-lisa.jpg", "/images/leonardo-last-supper.jpg", "/images/leonardo-self-portrait.jpg"], imageCaptions: ["La Joconde · vers 1503–1506", "La Cène · vers 1495–1498", "Portrait à la sanguine · attribution discutée"], categories: ["Peinture", "Peinture", "Dessin"], imageSources: ["https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_The_Last_Supper_high_res.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_self.jpg"] },
      { title: "Biographie", type: "text", heading: "Un esprit en mouvement", body: "Né à Vinci en 1452, Léonard de Vinci est peintre, ingénieur et observateur de la nature. Son œuvre traverse les disciplines : peinture, anatomie, architecture, mécanique et dessin. Il meurt à Amboise en 1519." },
      { title: "Contact", type: "contact", heading: "Explorer les archives", body: "Ressources, études et œuvres issues de collections publiques.", items: ["Œuvres", "Carnets", "Biographie"], image: "/images/leonardo-self-portrait.jpg" },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Leonardo da Vinci", body: "Portfolio d'atelier, peintures, carnets et recherches." }
    ],
    pageSections: [
      [
        { title: "Portrait", type: "hero", heading: "Leonardo da Vinci", body: "Peintre, dessinateur et chercheur de la Renaissance italienne. Un regard qui relie l'art, la nature et la science.", image: "/images/leonardo-self-portrait.jpg" },
        { title: "Œuvres choisies", type: "gallery", heading: "Œuvres et études", body: "Quelques œuvres majeures conservées et documentées à travers le monde.", items: ["La Joconde", "La Cène", "Portrait de Léonard"], images: ["/images/leonardo-mona-lisa.jpg", "/images/leonardo-last-supper.jpg", "/images/leonardo-self-portrait.jpg"], imageCaptions: ["La Joconde · vers 1503–1506", "La Cène · vers 1495–1498", "Portrait à la sanguine · attribution discutée"], categories: ["Peinture", "Peinture", "Dessin"], imageSources: ["https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_The_Last_Supper_high_res.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_self.jpg"] }
      ],
      [
        { title: "Œuvres", type: "gallery", heading: "Peintures et dessins", body: "Peintures et études attribuées à Léonard de Vinci, reproduites depuis des fichiers signalés domaine public sur Wikimedia Commons.", items: ["La Joconde", "La Cène", "Portrait de Léonard"], images: ["/images/leonardo-mona-lisa.jpg", "/images/leonardo-last-supper.jpg", "/images/leonardo-self-portrait.jpg"], imageCaptions: ["La Joconde · vers 1503–1506", "La Cène · vers 1495–1498", "Portrait à la sanguine · attribution discutée"], categories: ["Peinture", "Peinture", "Dessin"], imageSources: ["https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_The_Last_Supper_high_res.jpg", "https://commons.wikimedia.org/wiki/File:Leonardo_self.jpg"] }
      ],
      [
        { title: "Biographie", type: "text", heading: "Un esprit en mouvement", body: "Né à Vinci en 1452, Léonard de Vinci est peintre, ingénieur et observateur de la nature. Son œuvre traverse les disciplines : peinture, anatomie, architecture, mécanique et dessin. Il meurt à Amboise en 1519.", image: "/images/leonardo-self-portrait.jpg" }
      ],
      [
        { title: "Archives", type: "contact", heading: "Explorer les archives", body: "Ressources et reproductions issues de collections publiques.", items: ["Œuvres", "Carnets", "Biographie"], image: "/images/leonardo-self-portrait.jpg" }
      ]
    ]
  },
  {
    id: "atelier-ambre", name: "Atelier Ambre", coverImage: "/images/studio-art.jpg", design: "canvas", category: "Peinture", description: "Portfolio peinture en grille libre : fonds papier, couleurs d'atelier et œuvres en grand format.",
    colors: palettes.painter, hero: "La couleur comme lieu de rencontre", pages: ["Accueil", "Œuvres", "À propos", "Expositions", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "La couleur comme lieu de rencontre", body: "Peintures originales de Claire Morel, artiste à Lyon." },
      { title: "Œuvres", type: "gallery", heading: "Peintures récentes", body: "Une collection de paysages intérieurs, de lumière et de mémoire." },
      { title: "À propos", type: "text", heading: "Un atelier ouvert sur le monde", body: "Claire Morel explore la matière et les nuances dans son atelier lyonnais depuis 2012." },
      { title: "Expositions", type: "events", heading: "Rencontrons-nous", body: "Exposition « Les heures bleues », Galerie des Terreaux, Lyon, du 12 au 28 juin." },
      { title: "Contact", type: "contact", heading: "Parlons de votre projet", body: "Pour une œuvre, une collaboration ou une visite d'atelier, écrivez-moi." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Atelier Ambre", body: "Peintures originales de Claire Morel, artiste à Lyon." }
    ]
  },
  {
    id: "lumiere-lente", name: "Lumière lente", coverImage: "/images/lookbook-fashion.jpg", design: "lookbook", category: "Photographie", description: "Lookbook photographique sombre et plein cadre, organisé en séries visuelles.",
    colors: palettes.photo, hero: "Voir autrement, prendre le temps", pages: ["Accueil", "Séries", "Prestations", "Journal", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Voir autrement, prendre le temps", body: "Photographies de Nora Diallo, portraits, lieux et instants suspendus." },
      { title: "Séries", type: "gallery", heading: "Histoires en images", body: "Trois séries récentes entre lumière naturelle, mouvement et paysage." },
      { title: "Prestations", type: "pricing", heading: "Photographie sur mesure", body: "Portraits, reportages et images de marque, pensés ensemble." },
      { title: "Journal", type: "text", heading: "Notes de terrain", body: "Carnets d'images, repérages et histoires derrière les photographies." },
      { title: "Contact", type: "contact", heading: "Une idée en tête ?", body: "Parlons de votre prochain projet photo." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Lumière lente", body: "Photographies de Nora Diallo, portraits, lieux et instants suspendus." }
    ]
  },
  {
    id: "formes-vives", name: "Formes vives", coverImage: "/images/architecture.jpg", design: "brutalist", category: "Illustration & design", description: "Portfolio graphique brutaliste : typographie manifeste, aplats francs et grilles décalées.",
    colors: palettes.graphic, hero: "Des idées qui prennent forme", pages: ["Accueil", "Projets", "Services", "À propos", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Des idées qui prennent forme", body: "Studio Lila imagine des identités visuelles généreuses et singulières." },
      { title: "Projets", type: "gallery", heading: "Sélection de projets", body: "Identités, édition et images pour des marques qui ont quelque chose à raconter." },
      { title: "Services", type: "team", heading: "Du premier croquis au dernier détail", body: "Direction artistique · Identité visuelle · Illustration · Édition" },
      { title: "À propos", type: "text", heading: "Petit studio, grandes idées", body: "Lila Bensaïd travaille avec des lieux culturels, des artisans et des maisons indépendantes." },
      { title: "Contact", type: "contact", heading: "Créons quelque chose de beau", body: "Les projets bien racontés commencent par une conversation." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Formes vives", body: "Studio Lila, identités visuelles généreuses et singulières." }
    ]
  },
  {
    id: "matiere-brute", name: "Matière brute", coverImage: "/images/gallery-show.jpg", design: "minimal", category: "Sculpture", description: "Portfolio sculptural minimal, galerie aérée et typographie discrète.",
    colors: palettes.sculpture, hero: "La matière garde la mémoire", pages: ["Accueil", "Œuvres", "Démarche", "Expositions", "Atelier"],
    sections: [
      { title: "Accueil", type: "hero", heading: "La matière garde la mémoire", body: "Sculptures de terre et de pierre par Émile Vasseur." },
      { title: "Œuvres", type: "gallery", heading: "Formes façonnées", body: "Pièces uniques façonnées à la main, entre équilibre et accident." },
      { title: "Démarche", type: "text", heading: "Écouter la matière", body: "Chaque pièce commence par une rencontre avec un matériau et ses résistances." },
      { title: "Expositions", type: "events", heading: "Dates & rencontres", body: "« Terre en mouvement », Maison des métiers d'art, du 3 mai au 16 juin." },
      { title: "Atelier", type: "cta", heading: "Visiter l'atelier", body: "L'atelier est ouvert sur rendez-vous, au cœur du Vercors." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Matière brute", body: "Sculptures de terre et de pierre par Émile Vasseur." }
    ]
  },
  {
    id: "onde-claire", name: "Onde claire", coverImage: "/images/live-music.jpg", design: "stage", category: "Musique", description: "Portfolio musical nocturne : couverture d'album, dates de scène et lecteur d'écoute.",
    colors: palettes.music, hero: "Des chansons pour les jours ouverts", pages: ["Accueil", "Musique", "Concerts", "Vidéos", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Des chansons pour les jours ouverts", body: "Maëlle Rivière, autrice, compositrice et voix nomade." },
      { title: "Musique", type: "audio", heading: "Écouter le nouvel EP", body: "« La maison bleue », cinq chansons enregistrées au bord de l'Atlantique." },
      { title: "Concerts", type: "events", heading: "Sur scène bientôt", body: "14 juin · Le Périscope, Lyon · 20h30" },
      { title: "Vidéos", type: "video", heading: "Sessions en direct", body: "Une session acoustique enregistrée dans le jardin du studio." },
      { title: "Contact", type: "contact", heading: "Booking & collaborations", body: "Pour les concerts, la presse et les projets musicaux." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Onde claire", body: "Maëlle Rivière, autrice, compositrice et voix nomade." }
    ]
  },
  {
    id: "pages-sauvages", name: "Pages sauvages", coverImage: "/images/books-studio.jpg", design: "literary", category: "Écriture", description: "Portfolio littéraire en colonne de lecture, notes, livres et rendez-vous.",
    colors: palettes.writer, hero: "Des mots pour habiter le silence", pages: ["Accueil", "Livres", "Textes", "Agenda", "À propos"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Des mots pour habiter le silence", body: "Les livres et les nouvelles de Jeanne Aubert." },
      { title: "Livres", type: "gallery", heading: "À lire, à relire", body: "Romans, recueils et éditions choisies." },
      { title: "Textes", type: "text", heading: "Le carnet ouvert", body: "Fragments, notes de lecture et histoires en cours d'écriture." },
      { title: "Agenda", type: "events", heading: "Lectures & rencontres", body: "Lecture musicale à la Librairie des Halles, samedi 22 juin à 18h." },
      { title: "À propos", type: "text", heading: "Jeanne Aubert", body: "Écrivaine, lectrice et collectionneuse de carnets, installée à Arles." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Pages sauvages", body: "Les livres et les nouvelles de Jeanne Aubert." }
    ]
  },
  {
    id: "corps-en-scene", name: "Corps en scène", coverImage: "/images/artist-portrait.jpg", design: "movement", category: "Danse", description: "Portfolio chorégraphique expressif avec rythme, formes courbes et scènes vidéo.",
    colors: palettes.dance, hero: "Le mouvement ouvre des passages", pages: ["Accueil", "Spectacles", "Vidéos", "Cours", "Compagnie"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Le mouvement ouvre des passages", body: "La compagnie Traverse, chorégraphies de Samia Benali." },
      { title: "Spectacles", type: "events", heading: "À l'affiche", body: "« Nos lignes », Théâtre de la Croix-Rousse, 4 et 5 juillet." },
      { title: "Vidéos", type: "video", heading: "Le corps en images", body: "Extraits de spectacles et films chorégraphiques." },
      { title: "Cours", type: "pricing", heading: "Danser ensemble", body: "Ateliers contemporains pour tous les corps, débutants bienvenus." },
      { title: "Compagnie", type: "team", heading: "Une aventure collective", body: "Six interprètes, une chorégraphe et des rencontres qui déplacent les frontières." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Corps en scène", body: "La compagnie Traverse, chorégraphies de Samia Benali." }
    ]
  },
  {
    id: "hors-champ", name: "Hors-champ", coverImage: "/images/architecture.jpg", design: "cinema", category: "Cinéma", description: "Portfolio de cinéaste à l'esthétique de générique, images panoramiques et fiches de films.",
    colors: palettes.film, hero: "Des histoires à hauteur d'humain", pages: ["Accueil", "Films", "Festivals", "Services", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Des histoires à hauteur d'humain", body: "Films documentaires et créations de Thomas Girard." },
      { title: "Films", type: "video", heading: "Voir les films", body: "Un regard documentaire sur les gestes, les lieux et celles et ceux qui les habitent." },
      { title: "Festivals", type: "events", heading: "Projections & sélections", body: "« Les mains du fleuve », sélection officielle, Festival du réel, 2025." },
      { title: "Services", type: "pricing", heading: "Raconter votre projet", body: "Réalisation, image, montage et films de commande à taille humaine." },
      { title: "Contact", type: "contact", heading: "Parlons cinéma", body: "Pour une projection, une commande ou une collaboration." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Hors-champ", body: "Films documentaires et créations de Thomas Girard." }
    ]
  },
  {
    id: "maison-commune", name: "Maison commune", coverImage: "/images/gallery-show.jpg", design: "collective", category: "Galerie & collectif", description: "Site de galerie indépendant avec affiche d'exposition, artistes et calendrier.",
    colors: palettes.gallery, hero: "L'art se partage, les portes sont ouvertes", pages: ["Accueil", "Artistes", "Expositions", "Événements", "Visiter"],
    sections: [
      { title: "Accueil", type: "hero", heading: "L'art se partage, les portes sont ouvertes", body: "Maison Commune, galerie associative et collectif d'artistes à Nantes." },
      { title: "Artistes", type: "team", heading: "Celles et ceux qui font le lieu", body: "Peinture, photographie, céramique, édition et pratiques croisées." },
      { title: "Expositions", type: "gallery", heading: "En ce moment à la galerie", body: "« Jardins possibles », exposition collective jusqu'au 30 juin." },
      { title: "Événements", type: "events", heading: "À venir à la Maison", body: "Vernissage · jeudi 13 juin · 18h30, entrée libre." },
      { title: "Visiter", type: "map", heading: "Passez nous voir", body: "18 rue des Olivettes, Nantes · Mer–Sam, 11h–19h" },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Maison commune", body: "Galerie associative et collectif d'artistes à Nantes." }
    ]
  },
  {
    id: "terre-et-fil", name: "Terre & fil", coverImage: "/images/studio-art.jpg", design: "craft", category: "Artisanat", description: "Portfolio-boutique artisanal : matières naturelles, fiches de pièces et commandes.",
    colors: palettes.craft, hero: "Des objets faits pour durer", pages: ["Accueil", "Boutique", "Atelier", "Commandes", "Contact"],
    sections: [
      { title: "Accueil", type: "hero", heading: "Des objets faits pour durer", body: "Céramiques de table et bijoux textiles façonnés par Inès Laurent." },
      { title: "Boutique", type: "pricing", heading: "Petites séries, grandes histoires", body: "Pièces uniques et séries limitées, fabriquées dans notre atelier." },
      { title: "Atelier", type: "text", heading: "Fabriqué à la main, à Marseille", body: "Des matières locales, des gestes lents et une attention au détail." },
      { title: "Commandes", type: "cta", heading: "Une pièce à imaginer ?", body: "Commandes personnalisées ouvertes pour les événements et les beaux jours." },
      { title: "Contact", type: "contact", heading: "Écrivons-nous", body: "Pour une question, une commande ou une visite d'atelier." },
      { title: "Réseaux sociaux", type: "social", heading: "Suivez-nous", body: "Retrouvez l’actualité de l’atelier sur les réseaux." },
      { title: "Pied de page", type: "footer", heading: "Terre & fil", body: "Céramiques de table et bijoux textiles façonnés par Inès Laurent." }
    ]
  }
];

export const blockLibrary: Array<{ type: BlockType; label: string; description: string }> = [
  { type: "hero", label: "Bannière d'accueil", description: "Titre marquant, texte et appel à l'action." },
  { type: "text", label: "Texte", description: "Un texte de présentation ou une note." },
  { type: "image", label: "Image", description: "Une image mise en avant." },
  { type: "gallery", label: "Galerie d'œuvres", description: "Une sélection visuelle en mosaïque." },
  { type: "video", label: "Vidéo / Showreel", description: "Un film ou un extrait vidéo." },
  { type: "audio", label: "Lecteur audio", description: "Une piste, un album ou une session." },
  { type: "cta", label: "Bouton / CTA", description: "Une invitation à découvrir ou contacter." },
  { type: "contact", label: "Formulaire de contact", description: "Un point d'entrée pour les demandes." },
  { type: "testimonials", label: "Témoignages", description: "Quelques mots de clients ou partenaires." },
  { type: "pricing", label: "Tarifs / Prix des œuvres", description: "Une offre, un prix ou une pièce disponible." },
  { type: "events", label: "Expositions / Événements", description: "Dates, lieux et rendez-vous." },
  { type: "faq", label: "FAQ", description: "Réponses aux questions fréquentes." },
  { type: "map", label: "Carte", description: "Informations pour trouver un lieu." },
  { type: "footer", label: "Pied de page", description: "Coordonnées et liens de fin de page." },
  { type: "divider", label: "Séparateur", description: "Une respiration entre deux sections." },
  { type: "social", label: "Réseaux sociaux", description: "Liens vers vos réseaux." },
  { type: "stats", label: "Statistiques", description: "Quelques chiffres clés." },
  { type: "team", label: "Équipe / Artistes", description: "Présentez un collectif ou une équipe." }
];

const templateVisuals: Record<string, { hero: string; gallery: string[]; captions: string[] }> = {
  "atelier-ambre": {
    hero: "/images/studio-art.jpg",
    gallery: ["/images/studio-art.jpg", "/images/gallery-show.jpg", "/images/architecture.jpg"],
    captions: ["Pigments et lumière", "Étude de matière", "L'atelier, un paysage"]
  },
  "lumiere-lente": {
    hero: "/images/lookbook-fashion.jpg",
    gallery: ["/images/lookbook-fashion.jpg", "/images/artist-portrait.jpg", "/images/architecture.jpg"],
    captions: ["Silence: éditorial", "Visages en lumière", "Lignes de ville"]
  },
  "formes-vives": {
    hero: "/images/architecture.jpg",
    gallery: ["/images/studio-art.jpg", "/images/gallery-show.jpg", "/images/architecture.jpg"],
    captions: ["Identité : La Fabrique", "Édition: couleurs vives", "Système graphique"]
  },
  "matiere-brute": {
    hero: "/images/gallery-show.jpg",
    gallery: ["/images/gallery-show.jpg", "/images/studio-art.jpg", "/images/architecture.jpg"],
    captions: ["Volume I: argile", "L'atelier de taille", "Étude de forme"]
  },
  "onde-claire": {
    hero: "/images/live-music.jpg",
    gallery: ["/images/live-music.jpg", "/images/artist-portrait.jpg", "/images/lookbook-fashion.jpg"],
    captions: ["En concert", "Session acoustique", "Pochette: La maison bleue"]
  },
  "pages-sauvages": {
    hero: "/images/books-studio.jpg",
    gallery: ["/images/books-studio.jpg", "/images/studio-art.jpg", "/images/gallery-show.jpg"],
    captions: ["Le livre ouvert", "Notes de marge", "Rencontre en librairie"]
  },
  "corps-en-scene": {
    hero: "/images/lookbook-fashion.jpg",
    gallery: ["/images/lookbook-fashion.jpg", "/images/artist-portrait.jpg", "/images/live-music.jpg"],
    captions: ["Nos lignes: répétition", "Corps en mouvement", "Traverse: sur scène"]
  },
  "hors-champ": {
    hero: "/images/architecture.jpg",
    gallery: ["/images/architecture.jpg", "/images/gallery-show.jpg", "/images/artist-portrait.jpg"],
    captions: ["Les mains du fleuve", "Repérages", "Portraits de rive"]
  },
  "maison-commune": {
    hero: "/images/gallery-show.jpg",
    gallery: ["/images/gallery-show.jpg", "/images/studio-art.jpg", "/images/architecture.jpg"],
    captions: ["Jardins possibles", "Les artistes du lieu", "La galerie, Nantes"]
  },
  "terre-et-fil": {
    hero: "/images/studio-art.jpg",
    gallery: ["/images/studio-art.jpg", "/images/gallery-show.jpg", "/images/books-studio.jpg"],
    captions: ["Terre rouge: série", "Pièces de saison", "Objets faits main"]
  }
};

const id = () => Math.random().toString(36).slice(2, 10);
const makeTheme = (colors: Theme["colors"]): Theme => ({
  colors,
  buttons: { radius: 4, style: "plein" },
  typography: { headingFont: "Georgia", bodyFont: "Arial", h1: 58, h2: 36, h3: 24, body: 16, weight: 500 }
});

export function createTemplateSite(template: TemplateSummary): SiteDocument {
  const visuals = templateVisuals[template.id];
  const pages: SitePage[] = template.pages.map((title, pageIndex) => {
    const sectionDefinitions = template.pageSections?.[pageIndex] ??
      (pageIndex === 0 ? template.sections.slice(0, 3) : template.sections[pageIndex] ? [template.sections[pageIndex]] : []);
    return {
      id: id(),
      slug: pageIndex === 0 ? "accueil" : title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title,
      seoTitle: `${title}: ${template.name}`,
      seoDescription: sectionDefinitions[0]?.body ?? "",
      sections: sectionDefinitions.map((sectionDefinition) => ({
        id: id(),
        title: sectionDefinition.title,
        blocks: [{
          id: id(),
          type: sectionDefinition.type,
          content: {
            heading: sectionDefinition.heading,
            body: sectionDefinition.body,
            label: template.siteTitle ?? template.name,
            image: sectionDefinition.image ?? (sectionDefinition.type === "hero" ? visuals?.hero ?? "" : ""),
            items: sectionDefinition.items ?? (sectionDefinition.type === "gallery" ? visuals?.captions ?? ["Œuvre 01", "Œuvre 02", "Œuvre 03"] : [sectionDefinition.body, "Une démarche créative, sensible et singulière.", "Nouvelles créations à découvrir prochainement."]),
            images: sectionDefinition.images ?? (sectionDefinition.type === "gallery" ? visuals?.gallery ?? [] : []),
            imageCaptions: sectionDefinition.imageCaptions ?? (sectionDefinition.type === "gallery" ? visuals?.captions ?? [] : []),
            categories: sectionDefinition.categories ?? [],
            imageSources: sectionDefinition.imageSources ?? [],
            action: "Découvrir",
            email: "bonjour@atelier-exemple.fr"
          }
        }]
      }))
    };
  });
  // Every page ends with the template's social + footer blocks, so the
  // published view renders a complete footer (site nav, contact,
  // social links, copyright, back to top) on every page.
  const socialDefinition = template.sections.find((section) => section.type === "social");
  const footerDefinition = template.sections.find((section) => section.type === "footer");
  for (const page of pages) {
    const footerBlocks: Block[] = [];
    if (socialDefinition) {
      footerBlocks.push({
        id: id(),
        type: "social",
        content: {
          heading: socialDefinition.heading,
          body: socialDefinition.body,
          label: template.siteTitle ?? template.name,
          items: socialDefinition.items ?? ["Instagram", "Vimeo", "Newsletter"]
        }
      });
    }
    if (footerDefinition) {
      footerBlocks.push({
        id: id(),
        type: "footer",
        content: {
          heading: footerDefinition.heading,
          body: footerDefinition.body,
          label: template.siteTitle ?? template.name,
          email: "bonjour@atelier-exemple.fr"
        }
      });
    }
    if (footerBlocks.length > 0) page.sections.push({ id: id(), title: "Pied de page", blocks: footerBlocks });
  }
  return {
    id: id(),
    slug: template.id,
    publishedSlug: null,
    title: template.siteTitle ?? template.name,
    templateId: template.id,
    design: template.design,
    theme: makeTheme(template.colors),
    published: false,
    pages
  };
}

export function getTemplate(id: string): TemplateSummary | undefined {
  return templates.find((template) => template.id === id);
}

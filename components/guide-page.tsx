"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { useLocale, useT } from "@/lib/i18n";
import styles from "./legal-page.module.css";

// /guide — the complete user guide. Fully bilingual (English/French):
// the body lives here as two parallel texts and the component picks
// the one matching the visitor's language choice. Every step describes
// a feature that really exists in the code — the names used are the
// ones the product itself uses:
//
// - Account: /register (email + password, or "Continue with Google"),
//   /login to sign in again.
// - Create: /create opens the "Create exhibition" dialog — the title
//   is mandatory, the visitor picks a room model for the first room
//   (Sunlight Gallery by default); more rooms can be added in the
//   editor. Rooms: lib/rooms.ts (Sunlight Gallery, Elegant Gallery,
//   The Serpentine, The Vitrine, The Concrete Loft, …).
// - Editor: double-click to select, drag a selected artwork along its
//   wall, click a wall to paint it, "Compose wall" auto-hang (one row
//   at eye level, 1.50 m, 12 cm apart, largest in the centre, undone
//   in a single step — lib/compose-wall.ts), Ctrl+Z to undo, Save,
//   then Publish.
// - Sharing: status draft/published, visibility public (listed, may
//   appear in the Feed), private link (published, never listed, direct
//   URL only) or password (password asked before entering) —
//   prisma/schema.prisma, Exhibition.visibility.
// - Visit: entry screen with "Enter the room", a list view, and a
//   guided tour when the artist made one; WASD or arrow keys to walk,
//   drag to look, click the floor to walk to a spot, the floor plan
//   (mini-plan) to change rooms or jump to an artwork, click an
//   artwork for its details. No account needed to visit a public
//   exhibition.
// - Profile and works: Settings (display name, biography, photo,
//   password, delete account — which deletes exhibitions and artworks
//   with it), My artworks (/artworks, a reusable library), My
//   exhibitions (/exhibitions).
//
// Nothing is described here that the product does not do.

type GuideStep = { title: string; text: string };
type GuideSection = { id: string; title: string; intro: string; steps: GuideStep[] };

const CONTENT: Record<"en" | "fr", GuideSection[]> = {
  en: [
    {
      id: "account",
      title: "1. Create an account",
      intro: "You need an account to build and publish exhibitions. Visiting a public exhibition needs none.",
      steps: [
        {
          title: "Open the sign-up page",
          text: "Go to “Create my own” on the homepage, or open /register directly.",
        },
        {
          title: "Choose how to sign up",
          text: "Register with your email address and a password, or choose “Continue with Google” to sign up with your Google account. With Google, no password is set on Lakisa.",
        },
        {
          title: "Sign in",
          text: "Once your account is created you are signed in. Next time, use “Sign in” on the homepage (/login) with the same email and password, or with Google.",
        },
        {
          title: "Keep your password safe",
          text: "Do not share your account with anyone. If you forget your password, use “Forgot password” on the sign-in page to reset it by email.",
        },
      ],
    },
    {
      id: "create-exhibition",
      title: "2. Create an exhibition",
      intro: "An exhibition starts with a title and a first room. Everything else (more rooms, artworks, colours) happens in the editor.",
      steps: [
        {
          title: "Open Create",
          text: "From your workspace, open “Create” (/create). The “Create exhibition” dialog appears.",
        },
        {
          title: "Give it a title",
          text: "The title is mandatory. It is what visitors see first. You can change it later.",
        },
        {
          title: "Pick a room for the first room",
          text: "Choose a room model for your first room. Sunlight Gallery is the default: a bright room with skylights. You can add more rooms later, in the editor.",
        },
        {
          title: "Start as a draft",
          text: "Your new exhibition is a draft. Only you can see it until you publish it (see step 5).",
        },
      ],
    },
    {
      id: "artworks",
      title: "3. Add and place artworks",
      intro: "Your artworks live in a reusable library, and you hang them on the walls of the 3D editor.",
      steps: [
        {
          title: "Upload your works",
          text: "Open “My artworks” (/artworks) to upload images of your work with their title, medium and dimensions. The library is shared across all your exhibitions: upload once, hang anywhere.",
        },
        {
          title: "Add a work to a wall",
          text: "In the 3D editor, add an artwork from your library to the room. It appears on the wall, at real size, from the dimensions you gave it.",
        },
        {
          title: "Move it by hand",
          text: "Double-click an artwork to select it, then drag it along the wall to move it. Click a wall to select it, then pick a colour to paint it.",
        },
        {
          title: "Or let the editor hang the wall for you",
          text: "Select the works for a wall and use “Compose wall”. The editor hangs them in one row at eye level (1.50 m), 12 cm apart, the largest work in the centre. If the row does not fit, it packs them into the wall instead. The whole composition undoes in one step (Ctrl+Z), and you can still drag any work afterwards.",
        },
        {
          title: "Save",
          text: "Save your work in the editor before you leave, and save again before you publish.",
        },
      ],
    },
    {
      id: "rooms",
      title: "4. Choose a room",
      intro: "Each exhibition is built from one or more rooms. Every room has its own light, walls and floor.",
      steps: [
        {
          title: "Browse the room collection",
          text: "Open “Lakisa Galerie” (/galleries) to walk through the rooms: Sunlight Gallery, Elegant Gallery (a night gallery), The Serpentine, The Vitrine, The Concrete Loft, The Arch, The Blue Museum, and more.",
        },
        {
          title: "Add rooms in the editor",
          text: "In the editor, add rooms to your exhibition and choose a model for each. Rooms keep the layout they were designed with: you choose the room, you do not redraw it.",
        },
        {
          title: "Move between rooms while you work",
          text: "Open the floor plan at the bottom left of the editor to jump between rooms and artworks without walking.",
        },
      ],
    },
    {
      id: "share",
      title: "5. Share an exhibition",
      intro: "Publishing is a choice you make, and you decide who can enter. A draft is visible only to you.",
      steps: [
        {
          title: "Save, then Publish",
          text: "In the editor, save your exhibition, then press “Publish”. A dialog asks how visitors may enter.",
        },
        {
          title: "Public",
          text: "The exhibition is listed on Lakisa (Explore, and the public galleries) and open to everyone. A public exhibition may also appear in the Lakisa Feed.",
        },
        {
          title: "Private link",
          text: "The exhibition is published but never listed. Only people with the direct link can open it. Anyone who receives the link can pass it on, and if it spreads further than you intended, set a password or return the exhibition to draft.",
        },
        {
          title: "Password",
          text: "The exhibition is published, but visitors must enter a password you set before they can enter.",
        },
        {
          title: "Change your mind any time",
          text: "You can change the visibility of a published exhibition, or unpublish it, whenever you like. Unpublishing removes it from public listings.",
        },
      ],
    },
    {
      id: "visit",
      title: "6. Visit an exhibition",
      intro: "Visitors walk through the rooms in their browser. No account, no download, no app.",
      steps: [
        {
          title: "Open an exhibition",
          text: "Find one on the homepage, on Explore (/explore) or in the public galleries (/galleries), and open it. Public exhibitions open for everyone; a private-link exhibition needs its link, and a password exhibition asks for its password first.",
        },
        {
          title: "Enter the room",
          text: "The entry screen shows the exhibition's title, its artist and its artworks. Press “Enter the room” to walk in. If the artist made a guided tour, you can start it from here instead; a list view is also available if you prefer to browse the works first.",
        },
        {
          title: "Walk",
          text: "Use WASD or the arrow keys to move, drag to look around, and click the floor to walk to a spot. On a touch screen, use the on-screen walk controls.",
        },
        {
          title: "Use the floor plan",
          text: "Open the floor plan (the mini-plan) to see the rooms, jump to another room, or jump straight to an artwork.",
        },
        {
          title: "Look at a work up close",
          text: "Click an artwork to open its details: title, artist, medium, dimensions and description.",
        },
      ],
    },
    {
      id: "profile",
      title: "7. Manage your profile and your works",
      intro: "Everything you own lives in your workspace: your profile, your artworks and your exhibitions.",
      steps: [
        {
          title: "Edit your profile",
          text: "In Settings, change your display name, biography and profile photo. This is what visitors see next to your exhibitions.",
        },
        {
          title: "Manage your artworks",
          text: "“My artworks” (/artworks) is your library: edit a work's title or details there, and the change applies everywhere the work is hung.",
        },
        {
          title: "Manage your exhibitions",
          text: "“My exhibitions” (/exhibitions) lists everything you have built, drafts and published shows. Open any of them in the editor, change its visibility, or unpublish it.",
        },
        {
          title: "Change your password",
          text: "Change your password from Settings. If you signed up with Google, there is no Lakisa password to change.",
        },
        {
          title: "Delete your account",
          text: "You can delete your account from Settings. Deleting it deletes your exhibitions, your artworks and your profile with them, permanently. Keep a copy of your original files outside Lakisa first.",
        },
      ],
    },
  ],
  fr: [
    {
      id: "account",
      title: "1. Créer un compte",
      intro: "Il faut un compte pour créer et publier des expositions. Pour visiter une exposition publique, aucun compte n'est nécessaire.",
      steps: [
        {
          title: "Ouvrir la page d'inscription",
          text: "Allez sur « Créer la mienne » depuis l'accueil, ou ouvrez directement /register.",
        },
        {
          title: "Choisir comment s'inscrire",
          text: "Inscrivez-vous avec votre adresse e-mail et un mot de passe, ou choisissez « Continuer avec Google » pour vous inscrire avec votre compte Google. Avec Google, aucun mot de passe n'est défini sur Lakisa.",
        },
        {
          title: "Se connecter",
          text: "Une fois le compte créé, vous êtes connecté. La fois suivante, utilisez « Se connecter » sur l'accueil (/login) avec la même adresse e-mail et le même mot de passe, ou avec Google.",
        },
        {
          title: "Protéger son mot de passe",
          text: "Ne partagez votre compte avec personne. Si vous oubliez votre mot de passe, utilisez « Mot de passe oublié » sur la page de connexion pour le réinitialiser par e-mail.",
        },
      ],
    },
    {
      id: "create-exhibition",
      title: "2. Créer une exposition",
      intro: "Une exposition commence par un titre et une première salle. Tout le reste (d'autres salles, les œuvres, les couleurs) se fait dans l'éditeur.",
      steps: [
        {
          title: "Ouvrir Créer",
          text: "Depuis votre espace de travail, ouvrez « Créer » (/create). La fenêtre « Créer une exposition » s'affiche.",
        },
        {
          title: "Donner un titre",
          text: "Le titre est obligatoire. C'est ce que les visiteurs voient en premier. Vous pourrez le modifier plus tard.",
        },
        {
          title: "Choisir une salle pour la première salle",
          text: "Choisissez un modèle de salle pour votre première salle. Sunlight Gallery est le choix par défaut : une salle lumineuse avec des puits de lumière. Vous pourrez ajouter d'autres salles plus tard, dans l'éditeur.",
        },
        {
          title: "Commencer en brouillon",
          text: "Votre nouvelle exposition est un brouillon. Vous seul pouvez la voir jusqu'à sa publication (voir l'étape 5).",
        },
      ],
    },
    {
      id: "artworks",
      title: "3. Ajouter et placer des œuvres",
      intro: "Vos œuvres vivent dans une bibliothèque réutilisable, et vous les accrochez aux murs de l'éditeur 3D.",
      steps: [
        {
          title: "Mettre vos œuvres en ligne",
          text: "Ouvrez « Mes œuvres » (/artworks) pour mettre en ligne les images de vos œuvres, avec leur titre, leur technique et leurs dimensions. La bibliothèque est partagée par toutes vos expositions : on met en ligne une fois, on accroche partout.",
        },
        {
          title: "Ajouter une œuvre à un mur",
          text: "Dans l'éditeur 3D, ajoutez une œuvre de votre bibliothèque à la salle. Elle apparaît sur le mur, à taille réelle, d'après les dimensions que vous avez indiquées.",
        },
        {
          title: "La déplacer à la main",
          text: "Double-cliquez sur une œuvre pour la sélectionner, puis glissez-la le long du mur pour la déplacer. Cliquez sur un mur pour le sélectionner, puis choisissez une couleur pour le peindre.",
        },
        {
          title: "Ou laisser l'éditeur accrocher le mur",
          text: "Sélectionnez les œuvres d'un mur et utilisez « Compose wall ». L'éditeur les accroche en une rangée à hauteur des yeux (1,50 m), espacées de 12 cm, la plus grande œuvre au centre. Si la rangée ne tient pas, il les répartit sur le mur. Toute la composition s'annule en une seule étape (Ctrl+Z), et vous pouvez ensuite déplacer chaque œuvre à la main.",
        },
        {
          title: "Enregistrer",
          text: "Enregistrez votre travail dans l'éditeur avant de partir, et enregistrez à nouveau avant de publier.",
        },
      ],
    },
    {
      id: "rooms",
      title: "4. Choisir une salle",
      intro: "Chaque exposition est composée d'une ou plusieurs salles. Chaque salle a sa propre lumière, ses murs et son sol.",
      steps: [
        {
          title: "Parcourir la collection de salles",
          text: "Ouvrez « Lakisa Galerie » (/galleries) pour parcourir les salles : Sunlight Gallery, Elegant Gallery (une galerie de nuit), The Serpentine, The Vitrine, The Concrete Loft, The Arch, The Blue Museum, et d'autres.",
        },
        {
          title: "Ajouter des salles dans l'éditeur",
          text: "Dans l'éditeur, ajoutez des salles à votre exposition et choisissez un modèle pour chacune. Les salles gardent le plan pour lequel elles ont été conçues : vous choisissez la salle, vous ne la redessinez pas.",
        },
        {
          title: "Passer d'une salle à l'autre pendant le travail",
          text: "Ouvrez le plan au sol, en bas à gauche de l'éditeur, pour passer d'une salle à l'autre et d'une œuvre à l'autre sans marcher.",
        },
      ],
    },
    {
      id: "share",
      title: "5. Partager une exposition",
      intro: "La publication est un choix, et c'est vous qui décidez qui peut entrer. Un brouillon n'est visible que par vous.",
      steps: [
        {
          title: "Enregistrer, puis Publier",
          text: "Dans l'éditeur, enregistrez votre exposition, puis appuyez sur « Publier ». Une fenêtre demande comment les visiteurs peuvent entrer.",
        },
        {
          title: "Publique",
          text: "L'exposition est listée sur Lakisa (Explorer, et les galeries publiques) et ouverte à tous. Une exposition publique peut aussi apparaître dans le fil Lakisa.",
        },
        {
          title: "Lien privé",
          text: "L'exposition est publiée mais jamais listée. Seules les personnes qui ont le lien direct peuvent l'ouvrir. Toute personne qui reçoit le lien peut le transmettre, et s'il circule plus loin que prévu, mettez un mot de passe ou repassez l'exposition en brouillon.",
        },
        {
          title: "Mot de passe",
          text: "L'exposition est publiée, mais les visiteurs doivent saisir un mot de passe que vous avez défini avant d'entrer.",
        },
        {
          title: "Changer d'avis à tout moment",
          text: "Vous pouvez modifier la visibilité d'une exposition publiée, ou la dépublier, quand vous voulez. La dépublication la retire des listes publiques.",
        },
      ],
    },
    {
      id: "visit",
      title: "6. Visiter une exposition",
      intro: "Les visiteurs parcourent les salles dans leur navigateur. Pas de compte, pas de téléchargement, pas d'application.",
      steps: [
        {
          title: "Ouvrir une exposition",
          text: "Trouvez-en une sur l'accueil, sur Explorer (/explore) ou dans les galeries publiques (/galleries), et ouvrez-la. Les expositions publiques s'ouvrent à tous ; une exposition à lien privé exige son lien, et une exposition à mot de passe demande d'abord son mot de passe.",
        },
        {
          title: "Entrer dans la salle",
          text: "L'écran d'entrée montre le titre de l'exposition, son artiste et ses œuvres. Appuyez sur « Entrer dans la salle » pour y marcher. Si l'artiste a préparé une visite guidée, vous pouvez la lancer depuis ici ; une vue en liste est aussi disponible si vous préférez parcourir les œuvres d'abord.",
        },
        {
          title: "Marcher",
          text: "Utilisez ZQSD (WASD sur clavier anglais) ou les flèches pour vous déplacer, glissez pour regarder autour de vous, et cliquez sur le sol pour marcher jusqu'à un endroit. Sur écran tactile, utilisez les commandes de marche à l'écran.",
        },
        {
          title: "Utiliser le plan au sol",
          text: "Ouvrez le plan au sol (le mini-plan) pour voir les salles, passer dans une autre salle, ou aller directement à une œuvre.",
        },
        {
          title: "Regarder une œuvre de près",
          text: "Cliquez sur une œuvre pour ouvrir ses détails : titre, artiste, technique, dimensions et description.",
        },
      ],
    },
    {
      id: "profile",
      title: "7. Gérer son profil et ses œuvres",
      intro: "Tout ce qui vous appartient vit dans votre espace de travail : votre profil, vos œuvres et vos expositions.",
      steps: [
        {
          title: "Modifier son profil",
          text: "Dans les Paramètres, changez votre nom affiché, votre biographie et votre photo de profil. C'est ce que les visiteurs voient à côté de vos expositions.",
        },
        {
          title: "Gérer ses œuvres",
          text: "« Mes œuvres » (/artworks) est votre bibliothèque : modifiez le titre ou les détails d'une œuvre ici, et la modification s'applique partout où l'œuvre est accrochée.",
        },
        {
          title: "Gérer ses expositions",
          text: "« Mes expositions » (/exhibitions) liste tout ce que vous avez construit, brouillons et expositions publiées. Ouvrez chacune dans l'éditeur, changez sa visibilité, ou dépubliez-la.",
        },
        {
          title: "Changer son mot de passe",
          text: "Changez votre mot de passe depuis les Paramètres. Si vous vous êtes inscrit avec Google, il n'y a pas de mot de passe Lakisa à changer.",
        },
        {
          title: "Supprimer son compte",
          text: "Vous pouvez supprimer votre compte depuis les Paramètres. Sa suppression supprime aussi vos expositions, vos œuvres et votre profil, définitivement. Gardez d'abord une copie de vos fichiers originaux hors de Lakisa.",
        },
      ],
    },
  ],
};

export default function GuidePage() {
  const t = useT();
  const { locale } = useLocale();
  // The guide body is written in English and French only; every other
  // language falls back to English (the dictionary chrome around it is
  // translated into all eleven languages).
  const sections = CONTENT[locale === "fr" ? "fr" : "en"];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={52} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("guide", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("guide", "eyebrow")}</p>
        <h1 className={styles.title}>{t("guide", "title")}</h1>
        <p className={styles.intro}>{t("guide", "intro")}</p>
      </section>

      <div className={styles.body}>
        <ol className={styles.toc}>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>

        {sections.map((section) => (
          <section key={section.id} className={styles.section} id={section.id}>
            <h2>{section.title}</h2>
            <p>{section.intro}</p>
            <ol>
              {section.steps.map((step, index) => (
                <li key={index}>
                  <strong>{step.title}</strong>: {step.text}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section className={styles.section}>
          <h2>{t("guide", "needHelp")}</h2>
          <p>{t("guide", "needHelpText")}</p>
          <a className={styles.mailLink} href="mailto:contact@kabeyailunga.com">
            <Mail size={16} /> contact@kabeyailunga.com
          </a>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}

# Galleria (SANAA)

SANAA est une application indépendante de création et de visite d’expositions d’art virtuelles en 3D. Elle se trouve dans ce dossier et ne modifie pas le portfolio à la racine du dépôt.

## Fonctionnalités disponibles

- Création de compte et connexion avec adresse e-mail et mot de passe.
- Mots de passe hachés et cookie de session HTTP-only.
- Base SQLite locale avec comptes, expositions et œuvres.
- Tableau de bord personnel protégé.
- Éditeur de galerie Three.js : création de jusqu’à 12 salles, choix de leur forme, nom, couleurs et textures de murs (plâtre, béton, brique) et de sol (pierre, béton, bois); ajout de cloisons orientables et positionnables; éclairage par spots activable par salle; ajout d’un texte curatorial sur le mur; placement, rotation et mise à l’échelle des œuvres.
- Enregistrement de l’exposition dans la base de données.
- Publication et retrait d’une exposition avec une URL partageable.
- Visite publique à la première personne : déplacement avec WASD/flèches, commandes tactiles ou clic sur le sol pour marcher jusqu’au point choisi; passages par des portes entre les salles, plafonds, fenêtres, textures, spots, cartels curatoriaux, détails des œuvres et compteur de visites.
- Images téléversées et conservées dans `data/uploads/`; formats PNG, JPEG, WebP et AVIF, taille maximale de 8 Mo.
- Contrôle de propriété pour la modification des expositions et l’accès aux images non publiées.
- Script pour créer une exposition de démonstration AFROCENTRIK avec dix œuvres du portfolio réparties dans quatre salles.

L’application est le premier MVP. La récupération du mot de passe, la vérification d’adresse e-mail, les visites guidées, les paiements, le stockage cloud et les statistiques avancées ne sont pas encore implémentés. La base SQLite et les fichiers téléversés sont locaux : avant un déploiement public, il faut migrer vers PostgreSQL et un stockage objet durable.

## Démarrer en local

Node.js 20.9 ou ultérieur est requis. Dans un terminal PowerShell :

```powershell
cd SANAA
npm install
Copy-Item .env.example .env
```

Remplacez `SESSION_SECRET` dans `.env` par une valeur aléatoire d’au moins 32 caractères. Ensuite :

```powershell
npm run db:setup
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000), créez un compte, puis créez une exposition depuis le tableau de bord. Le raccourci `/editor` renvoie vers le tableau de bord; chaque exposition a son propre éditeur. Une fois publiée, l’exposition est accessible à `/exhibition/<slug>`.

Pour ajouter l’exposition de démonstration au compte local (après avoir créé le compte), lancez `npm run db:seed-demo`. Le script exige un seul compte SANAA local et ne crée pas de doublon.

`npm run build` compile l’application et `npm run typecheck` vérifie TypeScript.

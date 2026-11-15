# Lakisa — Remise à zéro de la base de production

**Décision :** Kabeya, 12 nov 2026, « Tout à zéro, sauf test et admin ».
Il a été prévenu que cela supprime aussi les deux expos du compte test
(« Already Enough As We Are » et « Toutes mes œuvres ») et il a confirmé.

**Statut : PRÉPARÉ, NON EXÉCUTÉ.** Rien n'a été supprimé. Le blocage :
l'URL de la base de production n'est pas sur cette VM (le `.env` local
est un placeholder). Elle est dans les variables d'environnement Vercel
du projet « galleria ». Il faut la récupérer via une tâche navigateur
sur le tableau de bord Vercel, ainsi que la valeur de `ADMIN_EMAILS`.

## Ce qui est prêt

- **Script :** `reset-to-zero.sh` (exécutable, syntaxe vérifiée, `pg_dump`
  et `psql` disponibles). Il fait, dans l'ordre : test de connexion →
  `pg_dump` complet dans `backups/lakisa-prod-avant-reset-<horodatage>.sql`
  (vérifié non vide) → état des lieux → contrôles de sécurité (compte
  test présent, au moins un admin identifié) → confirmation manuelle
  (taper YES) → suppression en UNE transaction (annulation en cas
  d'erreur) → vérification des compteurs → contrôle du site (200).
- **L'URL de la base n'est écrite nulle part.** Elle arrive par la
  variable d'environnement `DATABASE_URL` au moment de l'exécution
  uniquement, et n'apparaît dans aucun fichier ni rapport.

## Pour exécuter (quand l'URL est disponible)

```bash
export DATABASE_URL='postgres://...'   # URL de production (Vercel, projet galleria)
export ADMIN_EMAILS='kabeyailunga243@gmail.com'  # valeur exacte de Vercel (virgules si plusieurs)
cd ~/workspace/galleria
./reset-to-zero.sh
```

## Comptes gardés

- **Test :** test-sanaa-2026e@example.com (toujours présent, vérifié par le script).
- **Admin :** tout compte dont l'e-mail est dans `ADMIN_EMAILS`
  (l'exemple dans `lib/auth.ts` est `kabeyailunga243@gmail.com` — la
  valeur exacte de Vercel doit être confirmée), PLUS tout compte qui
  détient un grant `SubAdmin` (lu dans la base elle-même).
- Le script refuse de continuer si le compte test est absent ou si
  aucun admin n'est identifié.

## Périmètre de suppression

- **Supprimé :** tous les autres utilisateurs (cascade Prisma) ; toutes
  les expositions et œuvres (y compris celles du compte test et de
  l'admin, pour arriver à zéro) ; posts, likes, conversations, messages,
  listings, offres, commandes, contacts, library works, saved works,
  sites (Website Builder), open calls, équipes, referrals, usages de
  codes promo, tokens ; tous les `VisitLog`, `ToolUse`, `Upload` ;
  tous les abonnements sauf ceux des comptes gardés.
- **Gardé :** les comptes test + admin, leurs abonnements, leurs grants
  SubAdmin ; les définitions `SubscriptionPlan`, les `PromoCode`
  (réassignés à l'admin si leur créateur est supprimé, pour ne pas
  les perdre par cascade), `GalleryName`, `HiddenRoomTemplate`,
  `Template`.
- **Non touché :** fichiers R2, code, déploiements, variables Vercel.

## État final attendu

0 exposition, 0 œuvre, 0 visite, 0 post, 0 message, 0 annonce,
0 commande, 0 contact, 0 site, 0 open call. Restent : les comptes
test + admin et leurs abonnements. Le site répond toujours (200).

## Analyse du schéma (faits vérifiés dans `prisma/schema.prisma`)

- Presque toutes les relations vers `User` sont `onDelete: Cascade`
  (expositions, œuvres via exposition, posts, likes, messages,
  conversations, listings, offres, commandes, équipes, sites,
  open calls, abonnements, referrals, etc.) : supprimer un utilisateur
  supprime ses données.
- **Trois tables sans clé étrangère** (pas de cascade) : `VisitLog`
  (`exhibitionId`/`artworkId` simples), `ToolUse` (`userId` simple),
  `Upload` (`ownerId` simple). Le script les supprime explicitement.
- `Conversation.exhibition` / `artwork` et `Order.offer` sont
  `SetNull` : pas de blocage.
- `Subscription.plan` n'a pas de `onDelete` : on ne supprime pas les
  plans, donc pas de problème.
- `PromoCode.createdBy` est `Cascade` : un code créé par un compte
  supprimé disparaîtrait — le script le réassigne à l'admin avant.
- `SubAdmin.grantedBy` est `Cascade` : un grant donné par un compte
  supprimé disparaîtrait — le script réassigne le donneur à l'admin.
- `User.referredById` est une simple chaîne (pas de FK) : le script
  la met à NULL pour les comptes gardés si le parrain est supprimé.
- `Exhibition.views` est un compteur sur la ligne : il disparaît avec
  les expositions.

## Étape navigateur requise (pour l'agent parent)

Sur le tableau de bord Vercel (compte kabeya243, déjà connecté) :
projet « galleria » → Settings → Environment Variables → copier la
valeur de `DATABASE_URL` (production) et la valeur de `ADMIN_EMAILS`.
Ne les écrire dans aucun fichier. Les passer à l'exécution du script
par variables d'environnement, puis les oublier.

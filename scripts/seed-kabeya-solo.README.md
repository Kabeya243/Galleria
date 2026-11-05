# Kabeya Ilunga — solo exhibition on SANAA

Creates the public solo exhibition **“Already Enough As We Are”**
(`https://galleria-bice.vercel.app/exhibition/kabeya-ilunga-already-enough-as-we-are`):
1 White Cube room, 5 works, status `public` — so it appears on the public
homepage the moment it exists.

## Works in the show

| # | Work | Year | Medium | Dimensions | Source image |
|---|------|------|--------|------------|--------------|
| 1 | The Nose Ring | 2026 | Acrylics and charcoal on paper | 130 × 94 cm | `goals/dot-ateliers-2027-residency-application/files/Ilunga_Kabeya_TheNoseRing_Acrylics-Charcoal_2026_130x94cm.jpg` |
| 2 | The Boy with Gold Jewelry | 2026 | Acrylics, sequins and charcoal on paper | 120 × 89 cm | `goals/dot-ateliers-2027-residency-application/files/Ilunga_Kabeya_TheBoyWithGoldJewelry_Acrylics-Sequins-Charcoal_2026_120x89cm.jpg` |
| 3 | The Family Photograph | 2026 | Acrylics and charcoal on paper | 120 × 94 cm | `goals/dot-ateliers-2027-residency-application/files/Ilunga_Kabeya_TheFamilyPhotograph_Acrylics-Charcoal_2026_120x94cm.jpg` |
| 4 | Authenticity I | 2024 | Charcoal on paper | 120 × 89 cm | `site-kabeyailunga/images/works/authenticity-i.jpg` |
| 5 | Crown of Continuity | 2026 | Acrylics and graphite on paper | 120 × 89 cm | `site-kabeyailunga/images/works/crown-continuity.jpg` |

Deliberately excluded: **The Red Nails** and **Maze Of Blackness I, Genesis**
(both SOLD — never in a public catalogue). “Crown of Continuity”: title,
medium and dimensions come from the file name — confirm them with Kabeya
before or right after publishing.

## Option A — run the script (fastest)

Prerequisites:

1. The **Upload model** must exist in the generated Prisma client (it comes
   from the upload-to-database change: uploads stored in Postgres instead
   of `data/uploads`). If the script complains the model is missing, run
   `npx prisma generate` once that change is in place.
2. A `DATABASE_URL` pointing at the database to seed (production for the
   live site). The script refuses to run without one.
3. Kabeya's SANAA account email (default `kabeyailunga243@gmail.com`,
   override with `SEED_OWNER_EMAIL`).

```bash
cd ~/workspace/galleria
DATABASE_URL="postgres://..." \
SEED_OWNER_EMAIL="kabeyailunga243@gmail.com" \
node scripts/seed-kabeya-solo.mjs
```

The script is idempotent: if the exhibition already exists it prints its
URL and stops without creating anything. It never deletes or updates
existing rows.

Then verify: open the public URL, walk through the room, check every image
loads, and confirm the exhibition card shows on the homepage (`/` while
logged out).

## Option B — build it by hand in the editor

1. Sign in to SANAA as Kabeya, open the workspace, **Create an exhibition**.
2. Rename it **“Already Enough As We Are”**.
3. Keep the default room (White Cube, 18 × 12 m) as Room 1. No extra rooms.
4. For each work in the table above, in order: **Add artwork to room**,
   upload the source image, then set title, artist (Kabeya Ilunga), year,
   medium, dimensions and the short description (same texts as in the
   script). The editor places the works along the back wall by itself;
   spread them out if they sit too close.
5. Set the room's curatorial text to: **“We are already enough as we are.”**
6. **Save**, then **Publish**. The exhibition is public at
   `/exhibition/kabeya-ilunga-already-enough-as-we-are` and appears on the
   homepage.

## Undo

Delete the exhibition from the workspace (dashboard → exhibition → delete),
or from the database: `db.exhibition.delete({ where: { slug:
"kabeya-ilunga-already-enough-as-we-are" } })` — artworks are deleted with
it (cascade); the Upload rows stay and can be ignored or removed.

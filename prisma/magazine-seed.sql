-- Seed: the first Lakisa Magazine article (the open call story).
-- Published, attributed to the manager (kabeyailunga243@gmail.com).
-- Safe to re-run: ON CONFLICT (slug) DO NOTHING.
INSERT INTO "MagazineArticle"
  ("id", "slug", "title", "excerpt", "coverImageUrl", "content", "status", "views", "authorId", "createdAt", "updatedAt", "publishedAt")
VALUES
  (
    'cmw3e8x1a0000jy09a1b2c3d4',
    'lakisa-open-call-for-young-artists',
    'Your own gallery: Lakisa opens its first open call for young artists',
    'Lakisa is opening its doors. Young artists can now submit one to three works for a curated exhibition in a real 3D gallery. No fees, no account needed.',
    '/api/r2/magazine/open-call-sunlight-gallery.png',
    $$What would you hang in your own gallery?

Lakisa is a 3D gallery platform, made in Africa. Today, it opens its first call for young artists.

The idea is simple. Young artists submit one to three works. No account is needed, and there are no fees. Lakisa curates the exhibition, and the selected works are hung in a real 3D gallery, open to the world.

## A gallery without permission

For many young artists, the first exhibition is the hardest step. Galleries ask for a track record. Spaces ask for rent. Lakisa was built to remove that barrier: your own gallery, without asking for permission.

The open call is the first step. Artists keep their work, and the exhibition is theirs to share.

## How it works

Submit one to three works through the form at lakisa.art/open-call. No account is needed. Lakisa curates the selection, and the chosen works are shown in a 3D gallery that anyone can walk through from a phone or a computer.

Your first 3D exhibition, free.

## Apply

The call is open now. Apply at [lakisa.art/open-call](https://lakisa.art/open-call).$$,
    'published',
    0,
    'cmw3dv7ns0000jy080hbd1qv1',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;

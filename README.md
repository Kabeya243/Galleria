# Galleria (SANAA)

SANAA is a web app for creating and visiting virtual 3D art exhibitions.

## Stack

- Next.js 15 + React 19 + TypeScript, Tailwind CSS 4
- Three.js / React Three Fiber — the 3D gallery editor and public visits
- Prisma + PostgreSQL — accounts, exhibitions, artworks, saved tool work
- Cloudflare R2 (S3-compatible) — artwork image storage
- Nodemailer over SMTP — password recovery emails

## Features

- Email + password accounts, HTTP-only session cookie, password recovery
- Google sign-in (OAuth 2.0, no extra dependency) — see "Google sign-in" below
- Personal dashboard, exhibitions list, and a 3D editor: up to 12 rooms, 17 room templates, wall/floor/ceiling colours and textures, partition walls, track lighting, curatorial wall text, frames, and placeable elements
- Artwork uploads (PNG, JPEG, WebP, AVIF, HEIC/HEIF, compressed automatically) stored in R2
- Publish / unpublish with a shareable public URL; first-person public visits (WASD, touch, click-to-walk) with visit counts
- Galleries page with a live 3D preview of each room template
- Tools: price-your-work calculator, inventory & collections, contacts, present & sell, documents (certificates of authenticity), mockup studio, colour intelligence, presentation designer, photography lab
- Admin dashboard (owner-only) with tools-use tracking

## Run locally

Node.js 20.9 or later is required.

```bash
npm install
cp .env.example .env
```

Fill in `.env` (see `.env.example` for the full list of variables), then:

```bash
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then create an exhibition from the dashboard. Once published, an exhibition is available at `/exhibition/<slug>`.

To add the AFROCENTRIK demo exhibition to a local account, run `npm run db:seed-demo` (it requires exactly one local account and never creates a duplicate).

`npm run build` compiles the app and `npm run typecheck` checks TypeScript.

## Google sign-in

The "Continue with Google" button on the login and register pages uses
manual OAuth 2.0 (no extra dependency). It is **not** live until Google
credentials are created:

1. Google Cloud Console → APIs & Services → Credentials → Create
   Credentials → OAuth client ID → Web application.
2. Authorised redirect URI: `{origin}/api/auth/google/callback`
   (the site's own origin, e.g. `https://galleria-bice.vercel.app`).
3. Set the environment variables `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` (Vercel → Settings → Environment Variables,
   or `.env` locally).
4. Redeploy.

Until those two variables are set, `/api/auth/google` answers with a
plain error instead of redirecting — the flow is coded, only the
credentials are missing. A Google account has no password: email/password
login on it is refused with a "use Google" message, and signing in with
Google on an existing email account links the two (the email login keeps
working). See `lib/google-auth.ts`.

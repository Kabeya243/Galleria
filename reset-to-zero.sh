#!/usr/bin/env bash
# Lakisa production DB reset — "Tout à zéro, sauf test et admin"
#
# Confirmed by Kabeya (12 Nov 2026). Keeps ONLY the test account
# (test-sanaa-2026e@example.com) and the admin account(s) — admin = any
# account whose email is in ADMIN_EMAILS, plus any account holding a
# SubAdmin grant. Deletes everything else (users and their data,
# exhibitions, artworks, posts, messages, listings, offers, orders,
# visits, tool uses, uploads) so the counters read zero. Keeps the
# SubscriptionPlan definitions, PromoCode definitions, GalleryName /
# HiddenRoomTemplate / Template rows. Does NOT touch R2 files, code,
# or deployments.
#
# Usage:
#   export DATABASE_URL='postgres://...'   # production Neon URL (Vercel env vars, project galleria)
#   export ADMIN_EMAILS='kabeyailunga243@gmail.com'  # comma-separated (Vercel env vars)
#   ./reset-to-zero.sh
#
# The DATABASE_URL is used only for the database commands in this run
# and is never written to any file by this script.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="$PWD/backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/lakisa-prod-avant-reset-$STAMP.sql"

: "${DATABASE_URL:?DATABASE_URL is not set (production Neon URL from Vercel env vars)}"
: "${ADMIN_EMAILS:?ADMIN_EMAILS is not set (comma-separated admin emails from Vercel env vars)}"
command -v psql >/dev/null || { echo "psql not found"; exit 1; }
command -v pg_dump >/dev/null || { echo "pg_dump not found"; exit 1; }

echo "== 1. Connectivity =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "SELECT 'connected, postgres ' || version();" | head -c 120; echo

echo "== 2. Backup (pg_dump) =="
pg_dump "$DATABASE_URL" -F p -f "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || { echo "ERROR: backup file is empty"; exit 1; }
grep -q "CREATE TABLE" "$BACKUP_FILE" || grep -q "COPY public" "$BACKUP_FILE" || { echo "ERROR: backup does not look like a dump"; exit 1; }
echo "Backup OK: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "== 3. State before reset =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v admin_emails="$ADMIN_EMAILS" <<'SQL'
\echo '-- counts --'
SELECT 'users', count(*) FROM "User" UNION ALL
SELECT 'subscriptions', count(*) FROM "Subscription" UNION ALL
SELECT 'exhibitions', count(*) FROM "Exhibition" UNION ALL
SELECT 'artworks', count(*) FROM "Artwork" UNION ALL
SELECT 'visits', count(*) FROM "VisitLog" UNION ALL
SELECT 'tool_uses', count(*) FROM "ToolUse" UNION ALL
SELECT 'uploads', count(*) FROM "Upload" UNION ALL
SELECT 'posts', count(*) FROM "Post" UNION ALL
SELECT 'likes', count(*) FROM "Like" UNION ALL
SELECT 'messages', count(*) FROM "Message" UNION ALL
SELECT 'conversations', count(*) FROM "Conversation" UNION ALL
SELECT 'listings', count(*) FROM "Listing" UNION ALL
SELECT 'offers', count(*) FROM "Offer" UNION ALL
SELECT 'orders', count(*) FROM "Order" UNION ALL
SELECT 'contacts', count(*) FROM "Contact" UNION ALL
SELECT 'library_works', count(*) FROM "LibraryWork" UNION ALL
SELECT 'saved_works', count(*) FROM "SavedWork" UNION ALL
SELECT 'sites', count(*) FROM "Site" UNION ALL
SELECT 'open_calls', count(*) FROM "OpenCall" UNION ALL
SELECT 'referrals', count(*) FROM "Referral" UNION ALL
SELECT 'promo_codes', count(*) FROM "PromoCode" UNION ALL
SELECT 'promo_code_uses', count(*) FROM "PromoCodeUse" UNION ALL
SELECT 'subadmins', count(*) FROM "SubAdmin" UNION ALL
SELECT 'plans', count(*) FROM "SubscriptionPlan";
\echo '-- users (email, name, created) --'
SELECT email, name, "createdAt" FROM "User" ORDER BY "createdAt";
\echo '-- kept accounts (test + ADMIN_EMAILS + SubAdmin holders) --'
SELECT u.email, u.name,
  CASE WHEN lower(u.email) = 'test-sanaa-2026e@example.com' THEN 'test'
       WHEN lower(u.email) IN (SELECT lower(trim(x)) FROM unnest(string_to_array(:'admin_emails', ',')) AS x) THEN 'admin-email'
       ELSE 'subadmin' END AS keep_reason
FROM "User" u
WHERE lower(u.email) = 'test-sanaa-2026e@example.com'
   OR lower(u.email) IN (SELECT lower(trim(x)) FROM unnest(string_to_array(:'admin_emails', ',')) AS x)
   OR u.id IN (SELECT "userId" FROM "SubAdmin")
ORDER BY u."createdAt";
\echo '-- exhibitions per owner --'
SELECT u.email AS owner, count(e.id) AS exhibitions
FROM "Exhibition" e JOIN "User" u ON u.id = e."ownerId"
GROUP BY u.email ORDER BY exhibitions DESC;
\echo '-- promo codes and their creators (must all be kept accounts) --'
SELECT p.code, u.email AS created_by FROM "PromoCode" p JOIN "User" u ON u.id = p."createdById";
\echo '-- subadmin grants --'
SELECT u.email AS subadmin, g.email AS granted_by, s.permissions::text
FROM "SubAdmin" s JOIN "User" u ON u.id = s."userId" JOIN "User" g ON g.id = s."grantedById";
SQL

echo "== 4. Safety checks =="
KEPT_JSON="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -v admin_emails="$ADMIN_EMAILS" <<'SQL'
SELECT json_build_object(
  'test', (SELECT count(*) FROM "User" WHERE lower(email) = 'test-sanaa-2026e@example.com'),
  'admin_by_email', (SELECT count(*) FROM "User" WHERE lower(email) IN (SELECT lower(trim(x)) FROM unnest(string_to_array(:'admin_emails', ',')) AS x)),
  'subadmins', (SELECT count(*) FROM "SubAdmin")
);
SQL
)"
echo "kept: $KEPT_JSON"
TEST_N="$(echo "$KEPT_JSON" | grep -o '"test" : [0-9]*' | grep -o '[0-9]*')"
ADMIN_N="$(echo "$KEPT_JSON" | grep -o '"admin_by_email" : [0-9]*' | grep -o '[0-9]*')"
SUB_N="$(echo "$KEPT_JSON" | grep -o '"subadmins" : [0-9]*' | grep -o '[0-9]*')"
[ "${TEST_N:-0}" -ge 1 ] || { echo "ERROR: test account test-sanaa-2026e@example.com NOT FOUND — aborting"; exit 1; }
if [ "${ADMIN_N:-0}" -lt 1 ] && [ "${SUB_N:-0}" -lt 1 ]; then
  echo "ERROR: no admin account identified (no ADMIN_EMAILS match, no SubAdmin grant) — aborting"
  exit 1
fi
echo "Safety checks passed: test account present, admin identified."

echo "== 5. Confirmation =="
echo "This will DELETE all users except the kept accounts, all exhibitions,"
echo "artworks, posts, messages, listings, offers, orders, visits, tool uses"
echo "and uploads. The backup is at: $BACKUP_FILE"
read -r -p "Type YES to proceed: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Aborted (no changes made)."; exit 1; }

echo "== 6. Delete (single transaction, rolls back on any error) =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v admin_emails="$ADMIN_EMAILS" <<'SQL'
BEGIN;
-- Kept accounts: test + ADMIN_EMAILS + SubAdmin holders.
CREATE TEMP TABLE kept_users AS
SELECT id FROM "User"
WHERE lower(email) = 'test-sanaa-2026e@example.com'
   OR lower(email) IN (SELECT lower(trim(x)) FROM unnest(string_to_array(:'admin_emails', ',')) AS x)
   OR id IN (SELECT "userId" FROM "SubAdmin");

-- Safety: test must be kept, and at least one admin must be kept.
DO $$
DECLARE t int; k int;
BEGIN
  SELECT count(*) INTO t FROM kept_users ku JOIN "User" u ON u.id = ku.id
    WHERE lower(u.email) = 'test-sanaa-2026e@example.com';
  SELECT count(*) INTO k FROM kept_users;
  IF t = 0 THEN RAISE EXCEPTION 'test account not in kept set — aborting'; END IF;
  IF k < 2 THEN RAISE EXCEPTION 'no admin in kept set (kept=%) — aborting', k; END IF;
END $$;

-- Fallback owner for reassignments: first ADMIN_EMAILS account, else the test account.
CREATE TEMP TABLE fallback_owner AS
SELECT COALESCE(
  (SELECT id FROM "User" WHERE lower(email) IN
     (SELECT lower(trim(x)) FROM unnest(string_to_array(:'admin_emails', ',')) AS x) LIMIT 1),
  (SELECT id FROM "User" WHERE lower(email) = 'test-sanaa-2026e@example.com')
) AS id;

-- Promo codes created by deleted users would cascade-delete; reassign them to the fallback owner.
UPDATE "PromoCode" SET "createdById" = (SELECT id FROM fallback_owner)
WHERE "createdById" NOT IN (SELECT id FROM kept_users);
-- Sub-admin grants given by deleted users would cascade-delete; reassign the grantor.
UPDATE "SubAdmin" SET "grantedById" = (SELECT id FROM fallback_owner)
WHERE "grantedById" NOT IN (SELECT id FROM kept_users);
-- Kept users referred by a deleted user: clear the dangling plain-string reference.
UPDATE "User" SET "referredById" = NULL
WHERE id IN (SELECT id FROM kept_users)
  AND "referredById" IS NOT NULL
  AND "referredById" NOT IN (SELECT id FROM kept_users);

-- Non-FK usage tables (no cascade): delete all rows.
DELETE FROM "VisitLog";
DELETE FROM "ToolUse";
DELETE FROM "Upload";

-- Leaf data tables (delete before their parents; cascade would also handle most).
DELETE FROM "Message";
DELETE FROM "Like";
DELETE FROM "PromoCodeUse";
DELETE FROM "Referral";
DELETE FROM "OpenCallResponse";
DELETE FROM "OpenCallField";
DELETE FROM "Block";
DELETE FROM "Section";
DELETE FROM "Page";
DELETE FROM "Media";
DELETE FROM "TeamMember";
DELETE FROM "TeamComment";
DELETE FROM "TeamActivity";
DELETE FROM "ProjectShare";
DELETE FROM "Inquiry";
DELETE FROM "Offer";
DELETE FROM "Order";
DELETE FROM "SavedWork";
DELETE FROM "LibraryWork";
DELETE FROM "Contact";
DELETE FROM "UserBlock";
DELETE FROM "MessageReport";
DELETE FROM "PasswordResetToken";
DELETE FROM "EmailVerificationToken";
DELETE FROM "Conversation";
DELETE FROM "Post";
DELETE FROM "Artwork";
DELETE FROM "Listing";
DELETE FROM "OpenCall";
DELETE FROM "Team";
DELETE FROM "Site";
DELETE FROM "Exhibition";

-- Sub-admin grants of deleted users only (kept users keep theirs).
DELETE FROM "SubAdmin" WHERE "userId" NOT IN (SELECT id FROM kept_users);
-- Subscriptions of deleted users only (kept users keep theirs).
DELETE FROM "Subscription" WHERE "userId" NOT IN (SELECT id FROM kept_users);
-- All other users (cascade removes anything left).
DELETE FROM "User" WHERE id NOT IN (SELECT id FROM kept_users);
COMMIT;
SQL

echo "== 7. Verification (after) =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users', count(*) FROM "User" UNION ALL
SELECT 'subscriptions', count(*) FROM "Subscription" UNION ALL
SELECT 'exhibitions', count(*) FROM "Exhibition" UNION ALL
SELECT 'artworks', count(*) FROM "Artwork" UNION ALL
SELECT 'visits', count(*) FROM "VisitLog" UNION ALL
SELECT 'tool_uses', count(*) FROM "ToolUse" UNION ALL
SELECT 'uploads', count(*) FROM "Upload" UNION ALL
SELECT 'posts', count(*) FROM "Post" UNION ALL
SELECT 'likes', count(*) FROM "Like" UNION ALL
SELECT 'messages', count(*) FROM "Message" UNION ALL
SELECT 'conversations', count(*) FROM "Conversation" UNION ALL
SELECT 'listings', count(*) FROM "Listing" UNION ALL
SELECT 'offers', count(*) FROM "Offer" UNION ALL
SELECT 'orders', count(*) FROM "Order" UNION ALL
SELECT 'contacts', count(*) FROM "Contact" UNION ALL
SELECT 'library_works', count(*) FROM "LibraryWork" UNION ALL
SELECT 'saved_works', count(*) FROM "SavedWork" UNION ALL
SELECT 'sites', count(*) FROM "Site" UNION ALL
SELECT 'open_calls', count(*) FROM "OpenCall" UNION ALL
SELECT 'referrals', count(*) FROM "Referral" UNION ALL
SELECT 'promo_code_uses', count(*) FROM "PromoCodeUse" UNION ALL
SELECT 'promo_codes', count(*) FROM "PromoCode" UNION ALL
SELECT 'plans', count(*) FROM "SubscriptionPlan" UNION ALL
SELECT 'subadmins', count(*) FROM "SubAdmin";
SELECT 'remaining user:', email FROM "User" ORDER BY "createdAt";
SELECT 'remaining subscription:', u.email, p.slug, s.status
FROM "Subscription" s JOIN "User" u ON u.id = s."userId" JOIN "SubscriptionPlan" p ON p.id = s."planId";
SQL

echo "== 8. Site check =="
curl -s -o /dev/null -w "homepage https://lakisa.art -> %{http_code}\n" --max-time 20 https://lakisa.art || true
curl -s -o /dev/null -w "homepage https://galleria-bice.vercel.app -> %{http_code}\n" --max-time 20 https://galleria-bice.vercel.app || true

echo "Done. Backup: $BACKUP_FILE"

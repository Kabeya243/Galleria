# Email verification and SMTP setup (Lakisa)

## How verification works today

The whole flow is wired and live in the code; only the SMTP
credentials are missing, so no verification email can leave the server
yet.

1. **Signup** (`POST /api/auth/register`): the account is created
   **unverified**. `issueVerificationEmail` (`lib/email-verification.ts`)
   stores a token (only its SHA-256 hash is kept, 24 h lifetime,
   single use, previous unused tokens deleted so only the latest link
   works) and calls `sendVerificationEmail` (`lib/email.ts`). The raw
   token is never returned to any caller: it only ever travels inside
   the email. The response says whether the email was sent
   (`verificationEmailSent`), and the signup form shows "check your
   inbox" with a resend option.
2. **Sign-in** (`POST /api/auth/login`): an unverified account gets
   **403** with `emailNotVerified: true`, and the form offers a resend
   link instead of a dead end. Accounts created before verification
   shipped (before 2026-11-09, `EMAIL_VERIFICATION_CUTOFF` in
   `lib/email-verification.ts`) and Google sign-in accounts are
   grandfathered: they sign in normally. Do not move that cutoff.
3. **Verify** (`GET /api/auth/verify-email?token=...`, page
   `/verify-email`): the token is hashed and looked up, claimed
   atomically (two clicks on the same link verify exactly once), and
   the account's `emailVerifiedAt` is set. No session is created there:
   signing in stays the login form's job.
4. **Resend** (`POST /api/auth/resend-verification`): at most 5 emails
   per hour per address. Unknown addresses, already-verified accounts
   and rate-limited ones get the same answer, so the endpoint never
   reveals whether an address has an account.

Without SMTP configured, `sendVerificationEmail` returns false and
logs a server-side line ("EMAIL NOT SENT: verification email for
signup could not be sent — SMTP is not configured"). The account is
still created but stays unverified until the email can be sent; once
SMTP is set up, the resend link works.

The same SMTP settings also send password-reset emails
(`sendPasswordResetEmail`) and new-message notifications
(`sendNewMessageEmail`).

## What to do after buying lakisa.art and the pro emails

The pro mailbox lives on Zoho Mail (the studio already uses Zoho for
studio@kabeyailunga.com). Create the Lakisa mailbox first (for
example `contact@lakisa.art`), then set these five variables on
Vercel (Production + Preview), in the project settings, Environment
Variables. No value here is a placeholder to copy: each one comes
from the Zoho account.

| Variable | Value to set |
| --- | --- |
| `SMTP_HOST` | `smtp.zoho.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | The full pro email address (for example `contact@lakisa.art`) |
| `SMTP_PASS` | The mailbox password (or an app-specific password if the Zoho account has two-factor authentication) |
| `SMTP_FROM` | The same pro email address (what recipients see as the sender) |

The `.env.example` at the repo root already lists these five names
(empty, no fake credentials). After setting them on Vercel, redeploy
(the variables only take effect at the next deployment).

## How to verify it works

1. Register a new test account with an inbox you can open.
2. Check the inbox: the verification email arrives from the pro
   address, with a link to `/verify-email?token=...`.
3. Before clicking the link, try signing in with the new account:
   it must answer "Please verify your email before signing in."
4. Click the link: the page confirms the email. Sign in again: it
   works now.
5. Click the same link a second time: it must answer that the link is
   invalid or expired (single use).
6. On the login form, the resend link sends a fresh email (at most 5
   per hour for the same address).

## Troubleshooting

- No email arrives at all: check the Vercel function logs for the
  "EMAIL NOT SENT" line. If it is there, a variable is missing or
  wrong. If it is not there, the email was accepted by Zoho: check the
  spam folder and the Zoho sent folder.
- "Invalid or expired" on a fresh link: the link is 24 h, single use,
  and only the latest link works. Request a new one from the login
  form.
- An old account (created before 2026-11-09) signs in without
  verifying: that is the grandfathering rule, by design.

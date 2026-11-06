// Google sign-in (feature 9): manual OAuth 2.0, no new dependency.
//
// Setup — Google Cloud Console → APIs & Services → Credentials →
// OAuth client ID (Web application):
// - Authorised redirect URI: {origin}/api/auth/google/callback
//   (the site's own origin, e.g. https://galleria-bice.vercel.app)
// - Environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
//   (Vercel → Settings → Environment Variables).
// Until those two variables are set, /api/auth/google answers with a
// plain error instead of redirecting — the flow is coded, only the
// credentials are missing. Nothing about Google is faked: without real
// credentials the button cannot sign anyone in.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_OAUTH_STATE_COOKIE = "sanaa_oauth_state";

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** The redirect URI Google must call back to — the site's own origin. */
export function googleRedirectUri(request: Request): string {
  const origin = new URL(request.url).origin;
  return `${origin}/api/auth/google/callback`;
}

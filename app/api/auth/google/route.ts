import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GOOGLE_AUTH_URL,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleConfig,
  googleRedirectUri,
} from "@/lib/google-auth";

// Start Google sign-in (feature 9): redirect the visitor to Google with
// the app's client id, the callback URI and a random state token (kept
// in an httpOnly cookie, checked on the way back to stop CSRF). Without
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configured, this answers with
// a plain error instead of redirecting — see lib/google-auth.ts.
export async function GET(request: Request) {
  const config = googleConfig();
  if (!config) {
    return new NextResponse(
      "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see lib/google-auth.ts).",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}

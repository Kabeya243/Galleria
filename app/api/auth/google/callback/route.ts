import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  googleConfig,
  googleRedirectUri,
} from "@/lib/google-auth";

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

// Google sign-in callback (feature 9): verify the state token, exchange
// the code for tokens, read the Google profile, then find-or-create the
// account — by googleId first, then by email (a Google sign-in on an
// existing email account links it) — and sign the visitor in. A Google
// account has no password, so email/password login on it is refused
// with a "use Google" message (see app/api/auth/login/route.ts).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(`${origin}/login?error=google_cancelled`);
  if (!code || !state) return NextResponse.redirect(`${origin}/login?error=google`);

  // The state cookie was set by /api/auth/google; read it from the
  // request headers (this route runs before any page renders).
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
    ?.slice(GOOGLE_OAUTH_STATE_COOKIE.length + 1);
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(`${origin}/login?error=google_state`);
  }

  const config = googleConfig();
  if (!config) {
    return new NextResponse(
      "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see lib/google-auth.ts).",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: googleRedirectUri(request),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) return NextResponse.redirect(`${origin}/login?error=google`);
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) return NextResponse.redirect(`${origin}/login?error=google`);

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) return NextResponse.redirect(`${origin}/login?error=google`);
    const profile = (await profileResponse.json()) as GoogleUserInfo;
    if (!profile.sub || !profile.email) return NextResponse.redirect(`${origin}/login?error=google`);

    // Find-or-create: a returning Google account by googleId; an
    // existing email account is linked to Google (googleId set, no
    // password change — the email login keeps working).
    let user = await db.user.findUnique({ where: { googleId: profile.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.sub },
        });
      }
    }
    if (!user) {
      user = await db.user.create({
        data: {
          email: profile.email,
          name: profile.name?.trim() || profile.email.split("@")[0],
          googleId: profile.sub,
        },
      });
    }

    await createSession(user.id);
    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("Google sign-in failed.", err);
    return NextResponse.redirect(`${origin}/login?error=google`);
  }
}

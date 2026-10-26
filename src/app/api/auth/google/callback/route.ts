import { NextResponse, type NextRequest } from "next/server";
import { checkOAuthState, emailFromIdToken, exchangeCode, saveConnection } from "@/lib/google";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "g_oauth_state";

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(`/settings?google=${result}`, base));
    res.cookies.set(STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done("access_denied");
  if (!checkOAuthState(request.cookies.get(STATE_COOKIE)?.value, params.get("state"))) return done("state_mismatch");
  const code = params.get("code");
  if (!code) return done("missing_code");

  try {
    const tokens = await exchangeCode(code, `${base.replace(/\/$/, "")}/api/auth/google/callback`);
    if (!tokens.refresh_token) return done("no_refresh_token");
    const email = emailFromIdToken(tokens.id_token);
    if (!email) return done("no_email");
    await saveConnection(email, tokens.refresh_token, tokens.scope ?? "");
    return done("connected");
  } catch {
    return done("exchange_failed");
  }
}

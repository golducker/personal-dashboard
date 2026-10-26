import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET." }, { status: 500 });
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(clientId, `${base}/api/auth/google/callback`, state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}

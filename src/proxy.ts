import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Next 16: "middleware" was renamed to "proxy".
// /sw.js and /offline must stay reachable after the session expires (worker updates, offline fallback).
const PUBLIC_PATHS = ["/login", "/privacy", "/offline", "/sw.js", "/api/auth/login", "/api/auth/logout", "/manifest.webmanifest", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/sync/* is authenticated by its own bearer secret inside the route handler.
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/sync/")) {
    return NextResponse.next();
  }

  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};

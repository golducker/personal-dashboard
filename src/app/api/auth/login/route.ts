import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clientIp,
  signSession,
  verifyPasscode,
} from "@/lib/auth";
import { WINDOW_MS, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.SESSION_SECRET;
  const expected = process.env.DASHBOARD_PASSCODE;
  if (!secret || secret.length < 32 || !expected) {
    return NextResponse.json({ error: "Máy chủ chưa được cấu hình đăng nhập." }, { status: 500 });
  }

  let passcode = "";
  try {
    const body = await request.json();
    if (typeof body?.passcode === "string") passcode = body.passcode;
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  const ip = clientIp(request.headers);
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const failed = await db
    .select({ createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)),
    );

  // Global cap too, so rotating IPs can't brute-force the single passcode.
  const failedAll = await db
    .select({ createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));

  if (isRateLimited(failed.map((f) => f.createdAt)) || isRateLimited(failedAll.map((f) => f.createdAt), Date.now(), 20)) {
    return NextResponse.json(
      { error: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." },
      { status: 429 },
    );
  }

  const ok = verifyPasscode(passcode, expected);
  await db.insert(loginAttempts).values({ ip, success: ok });

  if (!ok) {
    return NextResponse.json({ error: "Mã truy cập không đúng." }, { status: 401 });
  }

  const token = await signSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Constant-time string comparison (compares SHA-256 digests so length does not leak). */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

export function verifyPasscode(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  return safeEqual(input, expected);
}

/** Validates an `Authorization: Bearer <secret>` header in constant time. */
export function checkBearer(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return safeEqual(match[1], secret);
}

function key(secret: string): Uint8Array {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(
  secret: string,
  opts: { expiresIn?: string | number; now?: Date } = {},
): Promise<string> {
  const iat = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(
      typeof opts.expiresIn === "number" ? iat + opts.expiresIn : (opts.expiresIn ?? iat + SESSION_MAX_AGE_SECONDS),
    )
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;
  try {
    await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

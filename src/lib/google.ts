import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { oauthTokens } from "@/db/schema";
import { safeEqual } from "./auth";
import { decrypt, encrypt } from "./crypto";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** "missing": never connected. "expired": token revoked/expired (Testing mode: 7 days) -> reconnect. */
export class GoogleNotConnectedError extends Error {
  skipLog: boolean;
  constructor(public reason: "missing" | "expired" = "missing") {
    super(reason === "missing" ? "Chưa kết nối Google" : "Phiên Google đã hết hạn, cần kết nối lại");
    this.name = "GoogleNotConnectedError";
    this.skipLog = reason === "missing";
  }
}

export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return u.toString();
}

/** Constant-time check of the returned state against the cookie value. */
export function checkOAuthState(cookie: string | undefined, param: string | null): boolean {
  if (!cookie || !param) return false;
  return safeEqual(cookie, param);
}

/** Reads the email claim from an id_token payload (no signature check: received directly from Google over TLS). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse & { ok: boolean }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...params,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  return { ...data, ok: res.ok };
}

export async function exchangeCode(code: string, redirectUri: string) {
  const data = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!data.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? "Không đổi được mã xác thực");
  return data;
}

const g = globalThis as unknown as { __googleAccess?: { token: string; expiresAt: number } | null };

export function clearAccessCache() {
  g.__googleAccess = null;
}

export type GoogleConnection = { email: string; scopes: string[]; updatedAt: Date };

export async function getConnection(): Promise<GoogleConnection | null> {
  const db = await getDb();
  const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
  if (!row) return null;
  return { email: row.accountEmail, scopes: row.scopes.split(" ").filter(Boolean), updatedAt: row.updatedAt };
}

export async function saveConnection(email: string, refreshToken: string, scopes: string): Promise<void> {
  const db = await getDb();
  await db.delete(oauthTokens).where(eq(oauthTokens.provider, "google"));
  await db
    .insert(oauthTokens)
    .values({ provider: "google", accountEmail: email, refreshTokenEncrypted: encrypt(refreshToken), scopes });
  clearAccessCache();
}

export async function disconnect(): Promise<void> {
  const db = await getDb();
  await db.delete(oauthTokens).where(eq(oauthTokens.provider, "google"));
  clearAccessCache();
}

export async function getAccessToken(): Promise<string> {
  const cached = g.__googleAccess;
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const db = await getDb();
  const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
  if (!row) throw new GoogleNotConnectedError("missing");

  let refreshToken: string;
  try {
    refreshToken = decrypt(row.refreshTokenEncrypted);
  } catch {
    await disconnect();
    throw new GoogleNotConnectedError("expired");
  }

  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (data.error === "invalid_grant") {
    await disconnect();
    throw new GoogleNotConnectedError("expired");
  }
  if (!data.ok || !data.access_token) throw new GoogleApiError(502, data.error_description ?? data.error ?? "Không làm mới được token Google");

  g.__googleAccess = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

/** Authenticated fetch against a Google API; throws GoogleApiError on non-2xx. Returns null on 204. */
export async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
    cache: "no-store",
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) clearAccessCache();
  if (!res.ok) throw new GoogleApiError(res.status, data?.error?.message ?? `Google API lỗi ${res.status}`);
  return data as T;
}

import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { checkBearer, safeEqual, signSession, verifyPasscode, verifySession } from "./auth";
import { isRateLimited } from "./rate-limit";

const SECRET = "x".repeat(40);

describe("passcode compare", () => {
  it("accepts the right passcode", () => expect(verifyPasscode("hunter2-hunter2", "hunter2-hunter2")).toBe(true));
  it("rejects wrong / empty / different length", () => {
    expect(verifyPasscode("nope", "hunter2-hunter2")).toBe(false);
    expect(verifyPasscode("", "hunter2-hunter2")).toBe(false);
    expect(verifyPasscode("x", undefined)).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});

describe("session JWT", () => {
  it("round-trips", async () => {
    expect(await verifySession(await signSession(SECRET), SECRET)).toBe(true);
  });
  it("rejects expired tokens", async () => {
    const old = await signSession(SECRET, { now: new Date(Date.now() - 3600_000), expiresIn: 60 });
    expect(await verifySession(old, SECRET)).toBe(false);
  });
  it("rejects tampered tokens and wrong secret", async () => {
    const t = await signSession(SECRET);
    const [h, p, s] = t.split(".");
    const tampered = `${h}.${p.slice(0, -2)}AA.${s}`;
    expect(await verifySession(tampered, SECRET)).toBe(false);
    expect(await verifySession(t, "y".repeat(40))).toBe(false);
    expect(await verifySession(undefined, SECRET)).toBe(false);
  });
  it("rejects alg=none style tokens", async () => {
    const forged = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"owner"}').toString("base64url")}.`;
    expect(await verifySession(forged, SECRET)).toBe(false);
    const hs512 = await new SignJWT({}).setProtectedHeader({ alg: "HS512" }).setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(hs512, SECRET)).toBe(false);
  });
});

describe("sync bearer check", () => {
  it("accepts matching bearer", () => expect(checkBearer("Bearer s3cret", "s3cret")).toBe(true));
  it("rejects missing, malformed, wrong, or unset secret", () => {
    expect(checkBearer(null, "s3cret")).toBe(false);
    expect(checkBearer("s3cret", "s3cret")).toBe(false);
    expect(checkBearer("Bearer wrong", "s3cret")).toBe(false);
    expect(checkBearer("Bearer ", "s3cret")).toBe(false);
    expect(checkBearer("Bearer s3cret", undefined)).toBe(false);
    expect(checkBearer("Bearer ", "")).toBe(false);
  });
});

describe("rate limit decision", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const minsAgo = (m: number) => new Date(+now - m * 60_000);
  it("allows under 5 failures", () => {
    expect(isRateLimited([1, 2, 3, 4].map(minsAgo), now)).toBe(false);
  });
  it("blocks at 5 failures within 15 minutes", () => {
    expect(isRateLimited([1, 2, 3, 4, 14].map(minsAgo), now)).toBe(true);
  });
  it("ignores failures older than 15 minutes", () => {
    expect(isRateLimited([1, 2, 3, 4, 16, 30].map(minsAgo), now)).toBe(false);
  });
  it("handles empty list", () => expect(isRateLimited([], now)).toBe(false));
});

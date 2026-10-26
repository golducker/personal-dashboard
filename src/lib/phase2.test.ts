import { describe, expect, it } from "vitest";
import { normalizeEvent } from "./calendar";
import { checkTimes } from "./calendar-schema";
import { decrypt, deriveKey, encrypt } from "./crypto";
import { buildAuthUrl, checkOAuthState, emailFromIdToken } from "./google";
import { decideStatus } from "./health";
import { shouldWriteRun } from "./run-log";
import { dayKey, groupByDay, startOfDay } from "./time";
import { collectPages, mapTask, splitByDue } from "./todoist";

describe("token encryption", () => {
  const key = deriveKey({ TOKEN_ENCRYPTION_KEY: "k".repeat(32) });
  it("round-trips and uses a fresh IV", () => {
    const a = encrypt("1//refresh-token", key);
    expect(decrypt(a, key)).toBe("1//refresh-token");
    expect(encrypt("1//refresh-token", key)).not.toBe(a);
  });
  it("rejects tampering and a wrong key", () => {
    const enc = encrypt("secret", key);
    const raw = Buffer.from(enc.slice(3), "base64url");
    raw[raw.length - 1] ^= 1;
    expect(() => decrypt("v1:" + raw.toString("base64url"), key)).toThrow();
    expect(() => decrypt(enc, deriveKey({ TOKEN_ENCRYPTION_KEY: "z".repeat(32) }))).toThrow();
  });
  it("falls back to SESSION_SECRET", () => {
    const k = deriveKey({ SESSION_SECRET: "s".repeat(40) });
    expect(k).toHaveLength(32);
    expect(k.equals(deriveKey({ TOKEN_ENCRYPTION_KEY: "s".repeat(40) }))).toBe(true);
  });
});

describe("OAuth", () => {
  it("checks state", () => {
    expect(checkOAuthState("abc", "abc")).toBe(true);
    expect(checkOAuthState("abc", "abd")).toBe(false);
    expect(checkOAuthState(undefined, "abc")).toBe(false);
    expect(checkOAuthState("abc", null)).toBe(false);
  });
  it("builds the consent URL", () => {
    const u = new URL(buildAuthUrl("cid", "http://x/cb", "st"));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("st");
    expect(u.searchParams.get("scope")).toContain("auth/calendar");
  });
  it("reads email from id_token", () => {
    const payload = Buffer.from(JSON.stringify({ email: "a@b.c" })).toString("base64url");
    expect(emailFromIdToken(`h.${payload}.s`)).toBe("a@b.c");
    expect(emailFromIdToken("garbage")).toBeNull();
  });
});

const cal = { id: "primary", name: "Cá nhân", color: "#123456" };

describe("calendar normalization", () => {
  it("timed event", () => {
    const e = normalizeEvent(
      { id: "1", summary: "Họp", start: { dateTime: "2026-10-26T09:00:00+07:00" }, end: { dateTime: "2026-10-26T10:00:00+07:00" }, location: "P.301" },
      cal,
    )!;
    expect(e).toMatchObject({ allDay: false, title: "Họp", calendarName: "Cá nhân", color: "#123456", location: "P.301" });
  });
  it("all-day event keeps date strings", () => {
    const e = normalizeEvent({ id: "2", summary: "Nghỉ", start: { date: "2026-10-26" }, end: { date: "2026-10-27" } }, cal)!;
    expect(e).toMatchObject({ allDay: true, start: "2026-10-26", end: "2026-10-27" });
  });
  it("drops cancelled events", () => {
    expect(normalizeEvent({ id: "3", status: "cancelled", start: { date: "2026-10-26" } }, cal)).toBeNull();
  });
  it("validates input times", () => {
    expect(checkTimes({ allDay: true, start: "2026-10-26" })).toEqual({ times: { allDay: true, start: "2026-10-26", end: "2026-10-26" } });
    expect("error" in checkTimes({ allDay: false, start: "2026-10-26T10:00:00+07:00", end: "2026-10-26T09:00:00+07:00" })).toBe(true);
    expect("error" in checkTimes({ allDay: false, start: "2026-10-26", end: "2026-10-27" })).toBe(true);
  });
});

describe("todoist", () => {
  it("maps tasks", () => {
    const t = mapTask({ id: "9", content: "Học", project_id: "p", priority: 4, due: { date: "2026-10-26", string: "hôm nay", is_recurring: false } });
    expect(t).toMatchObject({ id: "9", priority: 4, projectId: "p", due: { date: "2026-10-26", recurring: false } });
    expect(mapTask({ id: "1" }).due).toBeNull();
  });
  it("follows cursors", async () => {
    const pages: Record<string, { results: number[]; next_cursor: string | null }> = {
      start: { results: [1, 2], next_cursor: "c2" },
      c2: { results: [3], next_cursor: "c3" },
      c3: { results: [4], next_cursor: null },
    };
    const seen: Array<string | undefined> = [];
    const all = await collectPages<number>(async (c) => {
      seen.push(c);
      return pages[c ?? "start"];
    });
    expect(all).toEqual([1, 2, 3, 4]);
    expect(seen).toEqual([undefined, "c2", "c3"]);
  });
  it("splits overdue / today / later in Ho Chi Minh time", () => {
    // 2026-10-26 18:00 UTC is already 27/10 in Vietnam
    const now = new Date("2026-10-26T18:00:00Z");
    const mk = (id: string, date: string) => mapTask({ id, due: { date, string: date } });
    const s = splitByDue([mk("a", "2026-10-26"), mk("b", "2026-10-27"), mk("c", "2026-10-28"), mk("d", "2026-12-01")], now);
    expect(s.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(s.today.map((t) => t.id)).toEqual(["b"]);
    expect(s.later.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("day grouping", () => {
  it("uses Asia/Ho_Chi_Minh days", () => {
    expect(dayKey("2026-10-26T18:00:00Z")).toBe("2026-10-27");
    expect(startOfDay("2026-10-27").toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });
  it("groups, puts all-day first and spans multi-day all-day", () => {
    const g = groupByDay([
      { start: "2026-10-26T10:00:00+07:00", end: "2026-10-26T11:00:00+07:00", allDay: false, n: "late" },
      { start: "2026-10-26T08:00:00+07:00", end: "2026-10-26T09:00:00+07:00", allDay: false, n: "early" },
      { start: "2026-10-26", end: "2026-10-28", allDay: true, n: "trip" },
      { start: "2026-10-26T20:00:00Z", end: "2026-10-26T21:00:00Z", allDay: false, n: "next" },
    ]);
    expect(g.map((d) => d.day)).toEqual(["2026-10-26", "2026-10-27"]);
    expect(g[0].events.map((e) => e.n)).toEqual(["trip", "early", "late"]);
    expect(g[1].events.map((e) => e.n)).toEqual(["trip", "next"]);
  });
});

describe("recordRun throttle", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("success: once per 10 minutes", () => {
    expect(shouldWriteRun("success", null, now)).toBe(true);
    expect(shouldWriteRun("success", ago(9), now)).toBe(false);
    expect(shouldWriteRun("success", ago(10), now)).toBe(true);
  });
  it("error: once per 2 minutes", () => {
    expect(shouldWriteRun("error", ago(1), now)).toBe(false);
    expect(shouldWriteRun("error", ago(2), now)).toBe(true);
  });
});

describe("health status", () => {
  it("never-synced and not-connected labels", () => {
    expect(decideStatus({ configured: true, needsConnection: false, connected: false, latest: null })).toBe("never_synced");
    expect(decideStatus({ configured: true, needsConnection: true, connected: false, latest: "success" })).toBe("not_connected");
    expect(decideStatus({ configured: false, needsConnection: true, connected: false, latest: null })).toBe("not_configured");
    expect(decideStatus({ configured: true, needsConnection: true, connected: true, latest: "success" })).toBe("ok");
    expect(decideStatus({ configured: true, needsConnection: false, connected: false, latest: "error" })).toBe("error");
  });
});

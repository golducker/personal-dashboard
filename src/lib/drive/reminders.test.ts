import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { deadlines, pushSubscriptions, sources } from "@/db/schema";
import { decideWebpushStatus } from "@/lib/health";
import type { ParsedDeadline } from "./parsers";
import { buildReminder, selectDueReminders, sendDeadlineReminders } from "./reminders";
import { replaceFileDeadlines, upsertFiles } from "./sync";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

const pg = new PGlite();
const db = drizzle(pg, { schema });
type SyncDb = Parameters<typeof replaceFileDeadlines>[0];
type RemDb = Parameters<typeof selectDueReminders>[0];
const sdb = db as unknown as SyncDb;
const rdb = db as unknown as RemDb;

const NOW = new Date("2026-10-26T12:00:00Z");
const inH = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

let workSource = "";
let mlsvSource = "";

function pd(key: string, title: string, over: Partial<ParsedDeadline> = {}): ParsedDeadline {
  return { rowKey: key, title, dueAt: null, rawText: "", assignee: null, status: null, done: false, link: null, groupLabel: "G", groupDate: null, ...over };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  (globalThis as unknown as { __dashboardPromise: Promise<unknown> }).__dashboardPromise = Promise.resolve(db);
  [{ id: workSource }] = await db.insert(sources).values({ kind: "sheet", googleId: "w", label: "W", profile: "work" }).returning({ id: sources.id });
  [{ id: mlsvSource }] = await db.insert(sources).values({ kind: "sheet", googleId: "m", label: "M", profile: "mlsv" }).returning({ id: sources.id });
  const base = { name: "n", mimeType: "m", path: "n", parentId: null, modifiedTime: null };
  await upsertFiles(sdb, [
    { id: "FW", sourceId: workSource, ...base },
    { id: "FM", sourceId: mlsvSource, ...base },
  ]);
}, 60_000);

beforeEach(async () => {
  await db.delete(deadlines);
  await db.delete(pushSubscriptions);
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("deadline reminder selection", () => {
  it("picks only open, undismissed, un-reminded rows due in the next 24h", async () => {
    await replaceFileDeadlines(sdb, workSource, "FW", [
      pd("FW:t:1", "soon", { dueAt: inH(5) }),
      pd("FW:t:2", "later", { dueAt: inH(30) }),
      pd("FW:t:3", "past", { dueAt: inH(-1) }),
      pd("FW:t:4", "sheet done", { dueAt: inH(3), done: true }),
      pd("FW:t:5", "no date"),
      pd("FW:t:6", "progress done", { dueAt: inH(3) }),
      pd("FW:t:7", "postponed", { dueAt: inH(3) }),
      pd("FW:t:8", "dismissed", { dueAt: inH(3) }),
      pd("FW:t:9", "reminded", { dueAt: inH(3) }),
      pd("FW:t:10", "user reopened", { dueAt: inH(3), done: true }),
    ]);
    const set = (key: string, v: Partial<typeof deadlines.$inferInsert>) => db.update(deadlines).set(v).where(eq(deadlines.rowKey, key));
    await set("FW:t:6", { progress: "done" });
    await set("FW:t:7", { progress: "postponed" });
    await set("FW:t:8", { dismissed: true });
    await set("FW:t:9", { remindedAt: NOW });
    await set("FW:t:10", { progress: "ongoing" });

    const got = (await selectDueReminders(rdb, NOW)).map((r) => r.title).sort();
    expect(got).toEqual(["soon", "user reopened"]);
  });

  it("resets reminded_at only when the due date moves", async () => {
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "x", { dueAt: inH(5) })]);
    await db.update(deadlines).set({ remindedAt: NOW });
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "x renamed", { dueAt: inH(5) })]);
    expect((await db.select().from(deadlines))[0].remindedAt).toEqual(NOW);
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "x renamed", { dueAt: inH(8) })]);
    expect((await db.select().from(deadlines))[0].remindedAt).toBeNull();
  });
});

describe("buildReminder", () => {
  it("lists up to 3 titles and routes by profile", () => {
    const items = ["a", "b", "c", "d", "e"].map((t, i) => ({ id: String(i), title: t, profile: "work" }));
    expect(buildReminder(items)).toEqual({ title: "5 deadline trong 24h tới", body: "a, b, c và 2 việc khác", url: "/work", tag: "deadline-reminder" });
    expect(buildReminder([...items.slice(0, 2), { id: "x", title: "z", profile: "mlsv" }]).url).toBe("/");
    expect(buildReminder(items.slice(0, 2)).body).toBe("a, b");
  });
});

describe("sendDeadlineReminders", () => {
  async function subscribe() {
    await db.insert(pushSubscriptions).values({ endpoint: "https://push.example/1", keys: { p256dh: "k", auth: "a" } });
  }

  it("sends one grouped push and marks the rows reminded", async () => {
    await subscribe();
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "one", { dueAt: inH(2) }), pd("FW:t:2", "two", { dueAt: inH(4) })]);
    const n = await sendDeadlineReminders(rdb, NOW);
    expect(n).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1] as string);
    expect(payload).toMatchObject({ title: "2 deadline trong 24h tới", url: "/work", tag: "deadline-reminder" });
    expect((await db.select().from(deadlines)).every((r) => r.remindedAt)).toBe(true);
    // second run is a no-op
    expect(await sendDeadlineReminders(rdb, NOW)).toBe(0);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("keeps rows pending when nothing could be delivered", async () => {
    await subscribe();
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "one", { dueAt: inH(2) })]);
    expect(await sendDeadlineReminders(rdb, NOW)).toBe(0);
    expect((await db.select().from(deadlines))[0].remindedAt).toBeNull();
    expect((await db.select().from(pushSubscriptions))[0].failures).toBe(1);
  });

  it("does nothing without VAPID keys", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await replaceFileDeadlines(sdb, workSource, "FW", [pd("FW:t:1", "one", { dueAt: inH(2) })]);
    expect(await sendDeadlineReminders(rdb, NOW)).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("deletes subscriptions that answer 410", async () => {
    await subscribe();
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const { sendPush } = await import("@/lib/push");
    expect(await sendPush({ title: "t", body: "b" })).toEqual({ sent: 0, removed: 1, failed: 0 });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });
});

describe("decideWebpushStatus", () => {
  it("maps configuration and subscriptions", () => {
    expect(decideWebpushStatus(false, 3)).toBe("not_configured");
    expect(decideWebpushStatus(true, 0)).toBe("never_synced");
    expect(decideWebpushStatus(true, 1)).toBe("ok");
  });
});

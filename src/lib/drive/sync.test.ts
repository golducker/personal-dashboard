import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { deadlines, files, sources } from "@/db/schema";
import type { ParsedDeadline } from "./parsers";
import { replaceFileDeadlines, upsertFiles } from "./sync";

// In-memory PGlite with the real migrations; never touches the configured database.
const pg = new PGlite();
const db = drizzle(pg, { schema });
type Db = Parameters<typeof replaceFileDeadlines>[0];
const d = db as unknown as Db;

let sourceA = "";
let sourceB = "";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  [{ id: sourceA }] = await db.insert(sources).values({ kind: "folder", googleId: "gA", label: "A", profile: "mlsv" }).returning({ id: sources.id });
  [{ id: sourceB }] = await db.insert(sources).values({ kind: "sheet", googleId: "gB", label: "B", profile: "work" }).returning({ id: sources.id });
}, 60_000);

function pd(key: string, title: string, over: Partial<ParsedDeadline> = {}): ParsedDeadline {
  return { rowKey: key, title, dueAt: null, rawText: "", assignee: null, status: null, done: false, link: null, groupLabel: "G", groupDate: null, ...over };
}

describe("drive sync persistence", () => {
  it("upserts files without stealing a file owned by another source", async () => {
    const base = { name: "n", mimeType: "m", path: "n", parentId: null, modifiedTime: null };
    await upsertFiles(d, [{ id: "F1", sourceId: sourceA, ...base }]);
    await upsertFiles(d, [{ id: "F1", sourceId: sourceB, ...base, name: "other" }]);
    const [row] = await db.select().from(files).where(eq(files.id, "F1"));
    expect(row.sourceId).toBe(sourceA);
    expect(row.name).toBe("n");
    await upsertFiles(d, [{ id: "F1", sourceId: sourceA, ...base, name: "renamed" }]);
    expect((await db.select().from(files).where(eq(files.id, "F1")))[0].name).toBe("renamed");
  });

  it("upserts by row_key, deletes orphans, keeps manual overrides", async () => {
    await replaceFileDeadlines(d, sourceA, "F1", [pd("F1:t:1", "one"), pd("F1:t:2", "two"), pd("F1:t:3", "three", { dueAt: new Date("2026-10-30T10:00:00Z") })]);
    expect(await db.select().from(deadlines)).toHaveLength(3);

    await db.update(deadlines).set({ manualOverride: true, title: "mine" }).where(eq(deadlines.rowKey, "F1:t:2"));
    const res = await replaceFileDeadlines(d, sourceA, "F1", [pd("F1:t:1", "one edited", { done: true }), pd("F1:t:2", "two edited")]);
    expect(res).toEqual({ upserted: 2, deleted: 1 });

    const rows = await db.select().from(deadlines);
    const byKey = Object.fromEntries(rows.map((r) => [r.rowKey, r]));
    expect(byKey["F1:t:1"]).toMatchObject({ title: "one edited", done: true, sourceId: sourceA });
    expect(byKey["F1:t:2"].title).toBe("mine"); // manual override untouched
    expect(byKey["F1:t:3"]).toBeUndefined();

    // a file that no longer matches removes its rows, but not the override
    await replaceFileDeadlines(d, sourceA, "F1", []);
    expect((await db.select().from(deadlines)).map((r) => r.rowKey)).toEqual(["F1:t:2"]);
  });

  it("keeps the user's progress when a sheet is synced again", async () => {
    await upsertFiles(d, [{ id: "F2", sourceId: sourceA, name: "n2", mimeType: "m", path: "n2", parentId: null, modifiedTime: null }]);
    await replaceFileDeadlines(d, sourceA, "F2", [pd("F2:t:1", "p one"), pd("F2:t:2", "p two")]);
    const when = new Date("2026-10-26T01:00:00Z");
    await db.update(deadlines).set({ progress: "ongoing", progressUpdatedAt: when }).where(eq(deadlines.rowKey, "F2:t:1"));

    await replaceFileDeadlines(d, sourceA, "F2", [pd("F2:t:1", "p one edited", { done: true }), pd("F2:t:2", "p two")]);

    const rows = await db.select().from(deadlines).where(eq(deadlines.fileId, "F2"));
    const byKey = Object.fromEntries(rows.map((r) => [r.rowKey, r]));
    expect(byKey["F2:t:1"]).toMatchObject({ title: "p one edited", done: true, progress: "ongoing" });
    expect(byKey["F2:t:1"].progressUpdatedAt?.getTime()).toBe(when.getTime());
    expect(byKey["F2:t:2"].progress).toBeNull();
  });
});

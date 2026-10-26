import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines, files, settings, sources, syncRuns } from "@/db/schema";
import { GoogleApiError, GoogleNotConnectedError } from "@/lib/google";
import { sendPushSafe } from "@/lib/push";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { sendDeadlineReminders } from "./reminders";
import {
  MIME_FOLDER,
  MIME_SHEET,
  MIME_SHORTCUT,
  createDriveClient,
  type DriveClient,
  type DriveFile,
} from "./client";
import { readConfig } from "./config";
import { parseSheet, tabsToFetch, type ParsedDeadline } from "./parsers";

// Two Sheets reads per sheet; the read quota is 60 per user per minute.
export const MAX_SHEETS_PER_RUN = 25;
export const USER_TOKEN_KEY = "drive_user_change_token";

type Db = Awaited<ReturnType<typeof getDb>>;
type SourceRow = typeof sources.$inferSelect;
type FileInsert = typeof files.$inferInsert;

export type DriveSyncResult = {
  ok: boolean;
  sources: number;
  crawled: number;
  changed: number;
  removed: number;
  parsed: number;
  upserted: number;
  deleted: number;
  failed: number;
  /** Sheets still waiting to be parsed (budget or time ran out). */
  pending: number;
};

class OutOfTime extends Error {
  constructor() {
    super("out_of_time");
  }
}

type Ctx = { db: Db; client: DriveClient; deadlineAt: number; result: DriveSyncResult };

function checkTime(ctx: Ctx) {
  if (Date.now() > ctx.deadlineAt) throw new OutOfTime();
}

const joinPath = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);
/** Bump when a parser changes so every sheet is parsed again on the next run. */
const PARSE_VERSION = 3;
const marker = (modified: Date | null) => `v${PARSE_VERSION}:${modified?.toISOString() ?? "none"}`;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function toRow(f: DriveFile, sourceId: string, parentId: string | null, parentPath: string): FileInsert {
  return {
    id: f.id,
    sourceId,
    name: f.name,
    mimeType: f.mimeType,
    path: joinPath(parentPath, f.name),
    parentId,
    modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : null,
  };
}

/** Upserts file metadata. A file already owned by another source is left alone (files.id is global). */
export async function upsertFiles(db: Db, rows: FileInsert[]): Promise<void> {
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  for (const part of chunk(unique, 200)) {
    await db
      .insert(files)
      .values(part)
      .onConflictDoUpdate({
        target: files.id,
        set: {
          name: sql`excluded.name`,
          mimeType: sql`excluded.mime_type`,
          path: sql`excluded.path`,
          parentId: sql`excluded.parent_id`,
          modifiedTime: sql`excluded.modified_time`,
        },
        setWhere: sql`${files.sourceId} = excluded.source_id`,
      });
  }
}

/* ---------- crawling ---------- */

type Known = Map<string, { sourceId: string; path: string }>;

/** Recursive folder crawler: follows shortcuts to their targets and never visits a folder twice. */
function makeCrawler(ctx: Ctx, source: SourceRow, onRows?: (rows: FileInsert[]) => void) {
  const queue: { id: string; path: string }[] = [];
  const visited = new Set<string>();
  let pendingRows: FileInsert[] = [];
  let total = 0;

  async function flush() {
    if (pendingRows.length === 0) return;
    const rows = pendingRows;
    pendingRows = [];
    await upsertFiles(ctx.db, rows);
    total += rows.length;
    onRows?.(rows);
  }

  async function add(child: DriveFile, parentId: string | null, parentPath: string) {
    if (child.trashed) return;
    if (child.mimeType === MIME_SHORTCUT) {
      const target = child.shortcutDetails;
      if (!target?.targetId || visited.has(target.targetId)) return;
      visited.add(target.targetId);
      if (target.targetMimeType === MIME_FOLDER) {
        const row = toRow({ ...child, id: target.targetId, mimeType: MIME_FOLDER }, source.id, parentId, parentPath);
        pendingRows.push(row);
        queue.push({ id: target.targetId, path: row.path });
        return;
      }
      try {
        const file = await ctx.client.getFile(target.targetId);
        pendingRows.push(toRow(file, source.id, parentId, parentPath));
      } catch (e) {
        if (!(e instanceof GoogleApiError)) throw e; // no access to the target: skip it
      }
      return;
    }
    if (child.mimeType === MIME_FOLDER) {
      if (visited.has(child.id)) return;
      visited.add(child.id);
      const row = toRow(child, source.id, parentId, parentPath);
      pendingRows.push(row);
      queue.push({ id: child.id, path: row.path });
      return;
    }
    pendingRows.push(toRow(child, source.id, parentId, parentPath));
  }

  async function drain() {
    while (queue.length > 0) {
      checkTime(ctx);
      const batch = queue.splice(0, 4);
      const listed = await Promise.all(batch.map(async (f) => ({ f, children: await ctx.client.listChildren(f.id) })));
      for (const { f, children } of listed) for (const c of children) await add(c, f.id, f.path);
      await flush();
    }
    await flush();
  }

  return {
    visited,
    add,
    flush,
    drain,
    total: () => total,
    startFolder(id: string, path: string) {
      visited.add(id);
      queue.push({ id, path });
    },
  };
}

async function crawlSource(ctx: Ctx, source: SourceRow): Promise<number> {
  const crawler = makeCrawler(ctx, source);
  if (source.kind === "shared_drive") {
    const all = await ctx.client.listSharedDrive(source.googleId);
    const byId = new Map(all.map((f) => [f.id, f]));
    const memo = new Map<string, string>();
    const pathOf = (f: DriveFile, depth = 0): string => {
      const hit = memo.get(f.id);
      if (hit !== undefined) return hit;
      const parent = f.parents?.[0];
      const parentFile = parent && depth < 50 ? byId.get(parent) : undefined;
      const p = parentFile ? joinPath(pathOf(parentFile, depth + 1), f.name) : f.name;
      memo.set(f.id, p);
      return p;
    };
    const folderRows: FileInsert[] = [];
    for (const f of all) {
      const parent = f.parents?.[0] ?? null;
      const parentPath = parent && byId.has(parent) ? pathOf(byId.get(parent)!) : "";
      if (f.mimeType === MIME_FOLDER) {
        crawler.visited.add(f.id);
        folderRows.push(toRow(f, source.id, parent, parentPath));
      } else {
        await crawler.add(f, parent, parentPath);
      }
    }
    await upsertFiles(ctx.db, folderRows);
    await crawler.flush();
    await crawler.drain(); // folders reached only through shortcuts
    return crawler.total() + folderRows.length;
  }

  const root = await ctx.client.getFile(source.googleId);
  if (root.mimeType === MIME_FOLDER) {
    crawler.startFolder(root.id, "");
    await crawler.drain();
    return crawler.total();
  }
  await upsertFiles(ctx.db, [toRow(root, source.id, null, "")]);
  return 1;
}

/* ---------- incremental changes ---------- */

async function applyChanges(
  ctx: Ctx,
  srcs: SourceRow[],
  startToken: string,
  driveId: string | undefined,
  saveToken: (token: string) => Promise<void>,
): Promise<void> {
  const known: Known = new Map();
  for (const part of chunk(srcs.map((s) => s.id), 50)) {
    const rows = await ctx.db
      .select({ id: files.id, sourceId: files.sourceId, path: files.path })
      .from(files)
      .where(inArray(files.sourceId, part));
    for (const r of rows) known.set(r.id, { sourceId: r.sourceId, path: r.path });
  }
  const byId = new Map(srcs.map((s) => [s.id, s]));
  const roots = new Map(srcs.map((s) => [s.googleId, s]));

  const ownerOf = (f: DriveFile): SourceRow | null => {
    const k = known.get(f.id);
    if (k) return byId.get(k.sourceId) ?? null;
    const single = roots.get(f.id);
    if (single && (single.kind === "file" || single.kind === "sheet")) return single;
    for (const p of f.parents ?? []) {
      const root = roots.get(p);
      if (root) return root;
      const pk = known.get(p);
      if (pk) return byId.get(pk.sourceId) ?? null;
    }
    return null;
  };

  async function processPage(changes: { fileId: string; removed: boolean; file?: DriveFile }[]) {
    const gone = changes.filter((c) => c.removed || c.file?.trashed).map((c) => c.fileId).filter((id) => known.has(id));
    for (const part of chunk(gone, 200)) {
      await ctx.db.delete(files).where(inArray(files.id, part));
    }
    for (const id of gone) known.delete(id);
    ctx.result.removed += gone.length;

    let todo = changes.filter((c) => !c.removed && c.file && !c.file.trashed);
    let progressed = true;
    while (progressed && todo.length > 0) {
      progressed = false;
      const next: typeof todo = [];
      for (const c of todo) {
        const f = c.file!;
        const owner = ownerOf(f);
        if (!owner) {
          next.push(c);
          continue;
        }
        progressed = true;
        const parentId = f.parents?.find((p) => known.has(p) || roots.has(p)) ?? null;
        const parentPath = parentId ? (known.get(parentId)?.path ?? "") : "";
        const isNew = !known.has(f.id);
        const onRows = (rows: FileInsert[]) => {
          for (const r of rows) known.set(r.id, { sourceId: owner.id, path: r.path });
        };
        if (isNew && (f.mimeType === MIME_FOLDER || f.mimeType === MIME_SHORTCUT)) {
          const crawler = makeCrawler(ctx, owner, onRows);
          await crawler.add(f, parentId, parentPath);
          await crawler.drain();
        } else {
          const row = toRow(f, owner.id, parentId, parentPath);
          await upsertFiles(ctx.db, [row]);
          onRows([row]);
        }
        ctx.result.changed++;
      }
      todo = next;
    }
  }

  let token = startToken;
  for (;;) {
    checkTime(ctx);
    const page = await ctx.client.listChanges(token, driveId);
    await processPage(page.changes);
    const next = page.nextPageToken ?? page.newStartPageToken;
    if (next) {
      token = next;
      await saveToken(next); // only after the page is fully processed
    }
    if (!page.nextPageToken) break;
  }
}

async function getUserToken(db: Db): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, USER_TOKEN_KEY)).limit(1);
  const v = row?.value;
  // Stored as { token } because a bare numeric string ("95221") can come back from jsonb as a number.
  const raw = v && typeof v === "object" && "token" in v ? (v as { token: unknown }).token : v;
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : null;
}

async function setUserToken(db: Db, token: string) {
  const value = { token };
  await db
    .insert(settings)
    .values({ key: USER_TOKEN_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

const RECRAWL_MS = 24 * 60 * 60 * 1000;
const CRAWLED_PREFIX = "drive_crawled_at:";

async function getCrawledAt(db: Db): Promise<Map<string, number>> {
  const rows = await db.select().from(settings).where(sql`${settings.key} like ${CRAWLED_PREFIX + "%"}`);
  return new Map(rows.map((r) => [r.key.slice(CRAWLED_PREFIX.length), typeof r.value === "string" ? Date.parse(r.value) : 0]));
}

async function setCrawledAt(db: Db, sourceId: string) {
  const value = new Date().toISOString();
  await db
    .insert(settings)
    .values({ key: CRAWLED_PREFIX + sourceId, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/* ---------- deadlines ---------- */

/** Upserts a file's parsed rows by row_key, then deletes rows that vanished (never manual overrides). */
export async function replaceFileDeadlines(
  db: Db,
  sourceId: string,
  fileId: string,
  rows: ParsedDeadline[],
): Promise<{ upserted: number; deleted: number }> {
  for (const part of chunk(rows, 100)) {
    await db
      .insert(deadlines)
      .values(part.map((r) => ({ ...r, sourceId, fileId, confidence: 1 })))
      .onConflictDoUpdate({
        target: deadlines.rowKey,
        set: {
          title: sql`excluded.title`,
          dueAt: sql`excluded.due_at`,
          rawText: sql`excluded.raw_text`,
          assignee: sql`excluded.assignee`,
          status: sql`excluded.status`,
          done: sql`excluded.done`,
          link: sql`excluded.link`,
          groupLabel: sql`excluded.group_label`,
          groupDate: sql`excluded.group_date`,
          sourceId: sql`excluded.source_id`,
          // a moved due date is a new reminder
          remindedAt: sql`case when ${deadlines.dueAt} is distinct from excluded.due_at then null else ${deadlines.remindedAt} end`,
        },
        setWhere: eq(deadlines.manualOverride, false),
      });
  }
  const keep = new Set(rows.map((r) => r.rowKey));
  const existing = await db
    .select({ id: deadlines.id, rowKey: deadlines.rowKey })
    .from(deadlines)
    .where(and(eq(deadlines.fileId, fileId), eq(deadlines.manualOverride, false)));
  const orphans = existing.filter((e) => !e.rowKey || !keep.has(e.rowKey)).map((e) => e.id);
  for (const part of chunk(orphans, 200)) {
    await db.delete(deadlines).where(inArray(deadlines.id, part));
  }
  return { upserted: rows.length, deleted: orphans.length };
}

async function parsePending(ctx: Ctx, source: SourceRow, budget: { left: number }): Promise<void> {
  const config = readConfig(source.config);
  if (!config) return;
  const sheets = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.sourceId, source.id), eq(files.mimeType, MIME_SHEET)));
  const pending = sheets
    .filter((f) => f.contentHash !== marker(f.modifiedTime))
    .sort((a, b) => (b.modifiedTime?.getTime() ?? 0) - (a.modifiedTime?.getTime() ?? 0));

  let attempted = 0;
  for (const f of pending) {
    if (budget.left <= 0 || Date.now() > ctx.deadlineAt) break;
    budget.left--;
    attempted++;
    try {
      const titles = await ctx.client.getSpreadsheetTitles(f.id);
      const tabs = tabsToFetch(config, titles);
      const parsed = tabs.length ? parseSheet(config, { id: f.id, name: f.name }, await ctx.client.batchGetValues(f.id, tabs)) : [];
      const { upserted, deleted } = await replaceFileDeadlines(ctx.db, source.id, f.id, parsed);
      await ctx.db.update(files).set({ contentHash: marker(f.modifiedTime) }).where(eq(files.id, f.id));
      ctx.result.parsed++;
      ctx.result.upserted += upserted;
      ctx.result.deleted += deleted;
    } catch (e) {
      if (e instanceof GoogleNotConnectedError) throw e;
      if (e instanceof GoogleApiError && e.status === 429) {
        // Sheets read quota (per user per minute): stop and let the next run pick up the rest.
        attempted--;
        budget.left = 0;
        break;
      }
      ctx.result.failed++;
    }
  }
  ctx.result.pending += pending.length - attempted;
}

/* ---------- run ---------- */

function errorCode(e: unknown): string {
  if (e instanceof GoogleNotConnectedError) return e.reason === "expired" ? "google_expired" : "google_not_connected";
  if (e instanceof GoogleApiError) return `google_${e.status}`;
  return "unknown";
}

async function syncSharedDrive(ctx: Ctx, source: SourceRow) {
  if (!source.changeToken) {
    const token = await ctx.client.getStartPageToken(source.googleId);
    ctx.result.crawled += await crawlSource(ctx, source);
    await ctx.db.update(sources).set({ changeToken: token, lastSyncedAt: new Date() }).where(eq(sources.id, source.id));
    return;
  }
  await applyChanges(ctx, [source], source.changeToken, source.googleId, async (t) => {
    await ctx.db.update(sources).set({ changeToken: t }).where(eq(sources.id, source.id));
  });
  await ctx.db.update(sources).set({ lastSyncedAt: new Date() }).where(eq(sources.id, source.id));
}

async function syncUserFeed(ctx: Ctx, srcs: SourceRow[], onlyId?: string) {
  if (srcs.length === 0) return;
  const savedToken = await getUserToken(ctx.db);
  let token = savedToken;
  if (!token) {
    token = await ctx.client.getStartPageToken();
    await setUserToken(ctx.db, token);
  }
  // Without a saved token we may have missed changes: crawl everything again. Files other people own can
  // also slip past the user feed, so every source is re-crawled once a day as a safety net.
  const crawledAt = await getCrawledAt(ctx.db);
  const stale = (s: SourceRow) => Date.now() - (crawledAt.get(s.id) ?? 0) > RECRAWL_MS;
  const crawlNow = srcs.filter((s) => (!savedToken || !s.lastSyncedAt || stale(s)) && (!onlyId || s.id === onlyId));
  for (const s of crawlNow) {
    ctx.result.crawled += await crawlSource(ctx, s);
    await ctx.db.update(sources).set({ lastSyncedAt: new Date() }).where(eq(sources.id, s.id));
    await setCrawledAt(ctx.db, s.id);
  }
  if (savedToken) {
    const ready = srcs.filter((s) => s.lastSyncedAt && !crawlNow.includes(s));
    if (ready.length > 0) {
      // The feed is shared by every non-shared-drive source, so it must be applied to all of them.
      await applyChanges(ctx, ready, savedToken, undefined, (t) => setUserToken(ctx.db, t));
      await ctx.db.update(sources).set({ lastSyncedAt: new Date() }).where(inArray(sources.id, ready.map((s) => s.id)));
    }
  }
}

export async function runDriveSync(opts: { onlySourceId?: string; budgetMs?: number } = {}): Promise<{ status: number; result: DriveSyncResult }> {
  const db = await getDb();
  const startedAt = new Date();
  const result: DriveSyncResult = {
    ok: true, sources: 0, crawled: 0, changed: 0, removed: 0, parsed: 0, upserted: 0, deleted: 0, failed: 0, pending: 0,
  };
  const all = await db.select().from(sources);
  if (all.length === 0) return { status: 200, result };
  result.sources = opts.onlySourceId ? all.filter((s) => s.id === opts.onlySourceId).length : all.length;
  if (result.sources === 0) return { status: 404, result: { ...result, ok: false } };

  const [prev] = await db
    .select({ status: syncRuns.status })
    .from(syncRuns)
    .where(eq(syncRuns.source, "drive"))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  const ctx: Ctx = {
    db,
    client: createDriveClient(),
    deadlineAt: startedAt.getTime() + (opts.budgetMs ?? 240_000),
    result,
  };
  const errors: string[] = [];
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof OutOfTime) return;
      errors.push(errorCode(e));
    }
  };

  const selected = opts.onlySourceId ? all.filter((s) => s.id === opts.onlySourceId) : all;
  for (const s of selected.filter((x) => x.kind === "shared_drive")) await guard(() => syncSharedDrive(ctx, s));
  await guard(() => syncUserFeed(ctx, all.filter((x) => x.kind !== "shared_drive"), opts.onlySourceId));

  const budget = { left: MAX_SHEETS_PER_RUN };
  const fresh = await db.select().from(sources);
  for (const s of fresh.filter((x) => selected.some((y) => y.id === x.id))) {
    if (!s.lastSyncedAt) continue; // crawl failed or has not finished
    await guard(() => parsePending(ctx, s, budget));
  }

  const status = errors.length > 0 ? "error" : "success";
  const code = [...new Set(errors)].join(",");
  result.ok = status === "success";
  await db.insert(syncRuns).values({
    source: "drive",
    startedAt,
    finishedAt: new Date(),
    status,
    itemsCount: result.changed + result.crawled + result.upserted,
    error: status === "error" ? code : null,
  });
  if (status === "error" && prev?.status === "success") {
    await Promise.all([
      sendTelegram(`⚠️ <b>Drive sync lỗi</b>: ${escapeHtml(code)}`),
      sendPushSafe({ title: "Đồng bộ lỗi", body: `Drive: ${code}`, url: "/health", tag: "sync-drive" }),
    ]);
  } else if (status === "success" && prev?.status === "error") {
    await Promise.all([
      sendTelegram("✅ <b>Drive sync hồi phục</b>"),
      sendPushSafe({ title: "Đồng bộ đã hồi phục", body: "Drive hoạt động lại bình thường.", url: "/health", tag: "sync-drive" }),
    ]);
  }
  try {
    await sendDeadlineReminders(db);
  } catch {
    /* reminders are best-effort */
  }
  return { status: result.ok ? 200 : 502, result };
}

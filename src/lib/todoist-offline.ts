import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings, todoistOutbox } from "@/db/schema";
import { addDays, dayKey } from "./time";
import {
  closeTask,
  createTask,
  reopenTask,
  TodoistError,
  TodoistUnavailableError,
  updateTask,
  type NewTask,
  type TodoProject,
  type TodoTask,
} from "./todoist";
import { viDueToEnglish } from "./vi-due";

export type Op = "create" | "update" | "close" | "reopen";
export type OutboxRow = { id: string; seq: number; op: Op; taskId: string; payload: Partial<NewTask> | null };
export type Cache = { now: TodoTask[]; upcoming: TodoTask[]; projects: TodoProject[]; at: string };
export type FailedOp = { op: Op; taskId: string; content?: string; error: string; at: string };

const CACHE_KEY = "todoist_cache";
const FAILED_KEY = "todoist_outbox_failed";
const IDMAP_KEY = "todoist_idmap";
const isLocal = (id: string) => id.startsWith("local_");

// ---------- offline due estimate ----------

const EN_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Best-effort local guess of Todoist's due parsing, so queued tasks land in the right list. */
export function estimateDue(dueVi: string, now: Date = new Date()): { date: string; string: string; recurring: false } {
  const today = dayKey(now);
  let en = viDueToEnglish(dueVi);
  let time = "";
  en = en.replace(/\bat (\d{1,2}):(\d{2})\b/, (_, h, m) => {
    time = `${pad(Number(h))}:${m}`;
    return "";
  }).replace(/\s+/g, " ").trim();

  let date = today;
  let m: RegExpMatchArray | null;
  if (en === "" || en === "today") date = today;
  else if (en === "tomorrow") date = addDays(today, 1);
  else if (en === "next week") date = addDays(today, 7);
  else if ((m = en.match(/^in (\d+) days?$/))) date = addDays(today, Number(m[1]));
  else if ((m = en.match(/^(?:next )?([a-z]+)$/)) && EN_WEEKDAYS.includes(m[1])) {
    const cur = new Date(`${today}T00:00:00Z`).getUTCDay();
    date = addDays(today, (EN_WEEKDAYS.indexOf(m[1]) - cur + 7) % 7 || 7);
  } else if ((m = en.match(/^(\d{1,2}) ([a-z]{3})(?: (\d{4}))?$/)) && EN_MONTHS.includes(m[2])) {
    const mo = pad(EN_MONTHS.indexOf(m[2]) + 1);
    const day = pad(Number(m[1]));
    const year = m[3] ?? today.slice(0, 4);
    date = `${year}-${mo}-${day}`;
    if (!m[3] && date < today) date = `${Number(year) + 1}-${mo}-${day}`;
  }
  return { date: time ? `${date}T${time}:00` : date, string: dueVi, recurring: false };
}

// ---------- overlay (pure) ----------

function optimistic(id: string, p: Partial<NewTask>, now: Date): TodoTask {
  return {
    id,
    content: p.content ?? "",
    description: p.description ?? "",
    projectId: p.project_id ?? "",
    priority: (p.priority ?? 1) as TodoTask["priority"],
    due: p.due_string ? estimateDue(p.due_string, now) : null,
    labels: [],
    url: "",
  };
}

/**
 * Applies queued ops on top of a cached snapshot. Returns one merged task list (feed it to
 * splitByDue for both "now" and "upcoming") and the ids that have unsynced changes.
 */
export function applyOverlay(
  cache: Pick<Cache, "now" | "upcoming">,
  rows: Array<Pick<OutboxRow, "op" | "taskId" | "payload">>,
  now: Date = new Date(),
): { tasks: TodoTask[]; pendingIds: Set<string> } {
  const tasks = new Map<string, TodoTask>();
  for (const t of [...cache.now, ...cache.upcoming]) tasks.set(t.id, t);
  const removed = new Map<string, TodoTask>();
  const pendingIds = new Set<string>();
  for (const r of rows) {
    pendingIds.add(r.taskId);
    const p = r.payload ?? {};
    if (r.op === "create") tasks.set(r.taskId, optimistic(r.taskId, p, now));
    else if (r.op === "close") {
      const t = tasks.get(r.taskId);
      if (t) removed.set(r.taskId, t);
      tasks.delete(r.taskId);
    } else if (r.op === "reopen") {
      const t = removed.get(r.taskId);
      if (t) tasks.set(r.taskId, t);
      removed.delete(r.taskId);
    } else {
      const t = tasks.get(r.taskId) ?? removed.get(r.taskId);
      if (!t) continue;
      const next: TodoTask = {
        ...t,
        content: p.content ?? t.content,
        description: p.description ?? t.description,
        priority: (p.priority ?? t.priority) as TodoTask["priority"],
        due: p.due_string ? estimateDue(p.due_string, now) : t.due,
      };
      if (removed.has(r.taskId)) removed.set(r.taskId, next);
      else tasks.set(r.taskId, next);
    }
  }
  return { tasks: [...tasks.values()], pendingIds };
}

// ---------- flush core (pure-ish, executor injected) ----------

export type Executor = {
  create(payload: Partial<NewTask>): Promise<{ id: string }>;
  update(id: string, payload: Partial<NewTask>): Promise<unknown>;
  close(id: string): Promise<unknown>;
  reopen(id: string): Promise<unknown>;
};
export type FlushHooks = {
  done?(row: OutboxRow, realId?: string): Promise<void> | void;
  dropped?(row: OutboxRow, error: string): Promise<void> | void;
  stopped?(row: OutboxRow, error: string): Promise<void> | void;
};

/** Replays rows in order, remapping local ids to real ones. Stops at the first "unavailable" error; 4xx rows are dropped. */
export async function runOutbox(rows: OutboxRow[], exec: Executor, hooks: FlushHooks = {}, idMap = new Map<string, string>()) {
  const result = { done: 0, dropped: 0, stopped: false };
  for (const row of rows) {
    const id = idMap.get(row.taskId) ?? row.taskId;
    try {
      if (row.op !== "create" && isLocal(id)) throw new TodoistError(404, "Việc chưa được tạo trên Todoist");
      let realId: string | undefined;
      if (row.op === "create") realId = (await exec.create(row.payload ?? {})).id;
      else if (row.op === "update") await exec.update(id, row.payload ?? {});
      else if (row.op === "close") await exec.close(id);
      else await exec.reopen(id);
      if (realId) idMap.set(row.taskId, realId);
      result.done++;
      await hooks.done?.(row, realId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof TodoistError && !(e instanceof TodoistUnavailableError)) {
        result.dropped++;
        await hooks.dropped?.(row, msg);
        continue;
      }
      result.stopped = true;
      await hooks.stopped?.(row, msg);
      break;
    }
  }
  return result;
}

const liveExecutor: Executor = {
  create: (p) => createTask(p as NewTask),
  update: updateTask,
  close: closeTask,
  reopen: reopenTask,
};

// ---------- settings helpers ----------

async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return (row?.value as T) ?? null;
}

async function setSetting(key: string, value: unknown) {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function loadCache(): Promise<Cache | null> {
  try {
    return await getSetting<Cache>(CACHE_KEY);
  } catch {
    return null;
  }
}

let lastSaved: { json: string; at: number } | null = null;

/** Skips the write when the data is unchanged and was saved in the last 30 minutes (keeps Neon writes off most page loads). */
export async function saveCache(c: Omit<Cache, "at">): Promise<void> {
  const json = JSON.stringify(c);
  if (lastSaved?.json === json && Date.now() - lastSaved.at < 30 * 60_000) return;
  try {
    await setSetting(CACHE_KEY, { ...c, at: new Date().toISOString() });
    lastSaved = { json, at: Date.now() };
  } catch {}
}

/** Returns and clears the ops that Todoist rejected during replay. */
export async function takeFailed(): Promise<FailedOp[]> {
  try {
    const list = (await getSetting<FailedOp[]>(FAILED_KEY)) ?? [];
    if (list.length) await setSetting(FAILED_KEY, []);
    return list;
  } catch {
    return [];
  }
}

async function addFailed(f: FailedOp) {
  const list = (await getSetting<FailedOp[]>(FAILED_KEY)) ?? [];
  await setSetting(FAILED_KEY, [...list, f].slice(-20));
}

async function rememberId(localId: string, realId: string) {
  const map = (await getSetting<Record<string, string>>(IDMAP_KEY)) ?? {};
  await setSetting(IDMAP_KEY, Object.fromEntries(Object.entries({ ...map, [localId]: realId }).slice(-50)));
}

// ---------- outbox ----------

export async function listOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.select().from(todoistOutbox).orderBy(asc(todoistOutbox.seq));
  return rows.map((r) => ({ id: r.id, seq: r.seq, op: r.op, taskId: r.taskId, payload: (r.payload as Partial<NewTask> | null) ?? null }));
}

async function hasPending(): Promise<boolean> {
  try {
    const db = await getDb();
    return (await db.select({ id: todoistOutbox.id }).from(todoistOutbox).limit(1)).length > 0;
  } catch {
    return false; // outbox unreachable (e.g. migration not applied): behave like before, live only
  }
}

async function doFlush() {
  if (!(await hasPending())) return;
  const rows = await listOutbox();
  const db = await getDb();
  await runOutbox(rows, liveExecutor, {
    done: async (row, realId) => {
      await db.delete(todoistOutbox).where(eq(todoistOutbox.id, row.id));
      if (realId) {
        await db.update(todoistOutbox).set({ taskId: realId }).where(eq(todoistOutbox.taskId, row.taskId));
        await rememberId(row.taskId, realId).catch(() => {});
      }
    },
    dropped: async (row, error) => {
      await db.delete(todoistOutbox).where(eq(todoistOutbox.id, row.id));
      await addFailed({ op: row.op, taskId: row.taskId, content: row.payload?.content, error, at: new Date().toISOString() }).catch(() => {});
    },
    stopped: async (row, error) => {
      await db
        .update(todoistOutbox)
        .set({ attempts: sql`${todoistOutbox.attempts} + 1`, lastError: error.slice(0, 300) })
        .where(eq(todoistOutbox.id, row.id));
    },
  });
}

let inflight: Promise<void> | null = null;

/** Replays queued writes to Todoist. One flush at a time per process; one cheap query when the outbox is empty. */
export function flushOutbox(): Promise<void> {
  return (inflight ??= doFlush().finally(() => {
    inflight = null;
  }));
}

export async function queuedCount(): Promise<number> {
  return (await listOutbox()).length;
}

async function enqueue(op: Op, taskId: string, payload: Partial<NewTask> | null) {
  const db = await getDb();
  await db.insert(todoistOutbox).values({ op, taskId, payload });
}

export type WriteResult = { queued: boolean; task?: TodoTask };

/** Runs a Todoist write live, or queues it (preserving order) while Todoist is unavailable. */
export async function queueOrRun(op: Op, taskId: string | null, payload: Partial<NewTask> | null = null): Promise<WriteResult> {
  await flushOutbox().catch(() => {});
  let id = taskId ?? "";
  if (isLocal(id)) id = ((await getSetting<Record<string, string>>(IDMAP_KEY).catch(() => null)) ?? {})[id] ?? id;

  const queue = async (): Promise<WriteResult> => {
    if (op === "create") {
      const localId = `local_${crypto.randomUUID()}`;
      await enqueue(op, localId, payload);
      return { queued: true, task: optimistic(localId, payload ?? {}, new Date()) };
    }
    await enqueue(op, id, payload);
    return { queued: true };
  };

  if (isLocal(id) || (await hasPending())) return queue();
  try {
    if (op === "create") return { queued: false, task: await createTask(payload as NewTask) };
    if (op === "update") return { queued: false, task: await updateTask(id, payload ?? {}) };
    if (op === "close") await closeTask(id);
    else await reopenTask(id);
    return { queued: false };
  } catch (e) {
    if (e instanceof TodoistUnavailableError) return queue();
    throw e;
  }
}

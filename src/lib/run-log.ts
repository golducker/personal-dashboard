import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { syncRuns, type SyncSource } from "@/db/schema";

export const SUCCESS_THROTTLE_MS = 10 * 60_000;
export const ERROR_THROTTLE_MS = 2 * 60_000;

/** Pure throttle decision: should a run of this kind be written given the last one of the same kind? */
export function shouldWriteRun(
  kind: "success" | "error",
  lastSameKindAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastSameKindAt) return true;
  const window = kind === "success" ? SUCCESS_THROTTLE_MS : ERROR_THROTTLE_MS;
  return now.getTime() - lastSameKindAt.getTime() >= window;
}

async function write(source: SyncSource, kind: "success" | "error", startedAt: Date, items: number, error?: string) {
  try {
    const db = await getDb();
    const [last] = await db
      .select({ at: syncRuns.startedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.source, source), eq(syncRuns.status, kind)))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    if (!shouldWriteRun(kind, last?.at ?? null)) return;
    await db.insert(syncRuns).values({
      source,
      startedAt,
      finishedAt: new Date(),
      status: kind,
      itemsCount: items,
      error: error ?? null,
    });
  } catch {
    // logging must never break the actual request
  }
}

/** Runs fn, logs the outcome to sync_runs (throttled) and rethrows failures. */
export async function recordRun<T>(
  source: SyncSource,
  fn: () => Promise<T>,
  count: (result: T) => number = (r) => (Array.isArray(r) ? r.length : 0),
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await fn();
    await write(source, "success", startedAt, count(result));
    return result;
  } catch (e) {
    // errors flagged skipLog mean "not set up yet", not a failure worth logging
    if (!(e instanceof Error && (e as { skipLog?: boolean }).skipLog)) {
      await write(source, "error", startedAt, 0, e instanceof Error ? e.message : String(e));
    }
    throw e;
  }
}

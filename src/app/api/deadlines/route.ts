import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines } from "@/db/schema";
import { apiError } from "@/lib/api";
import { bulkProgressSchema, readProgress, type ProgressInput } from "@/lib/drive/progress";

export const dynamic = "force-dynamic";

/**
 * Sets the user's own progress on several deadlines in one request.
 * Returns each row's previous value so the client can undo; ids that no longer exist are skipped.
 * One UPDATE per target value (at most five): neon-http has no transactions, but each statement is atomic.
 */
export async function PATCH(request: Request) {
  try {
    const { items } = bulkProgressSchema.parse(await request.json());
    const db = await getDb();
    const target = new Map(items.map((i) => [i.id, i.progress])); // last write wins for a repeated id
    const rows = await db
      .select({ id: deadlines.id, progress: deadlines.progress })
      .from(deadlines)
      .where(inArray(deadlines.id, [...target.keys()]));

    const byValue = new Map<ProgressInput, string[]>();
    for (const r of rows) {
      const v = target.get(r.id)!;
      byValue.set(v, [...(byValue.get(v) ?? []), r.id]);
    }
    const now = new Date();
    for (const [progress, ids] of byValue) {
      await db.update(deadlines).set({ progress, progressUpdatedAt: now }).where(inArray(deadlines.id, ids));
    }

    const previous = rows.map((r) => ({ id: r.id, progress: readProgress(r.progress) }));
    return NextResponse.json({ updated: previous.length, previous });
  } catch (e) {
    return apiError(e);
  }
}

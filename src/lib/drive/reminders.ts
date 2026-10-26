import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { getDb } from "@/db";
import { deadlines, sources } from "@/db/schema";
import { isPushConfigured, sendPush } from "@/lib/push";

type Db = Awaited<ReturnType<typeof getDb>>;

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DueReminder = { id: string; title: string; profile: string | null };

/** Open (effective not done/postponed), not dismissed, due within the next 24h, not yet reminded. */
export async function selectDueReminders(db: Db, now = new Date()): Promise<DueReminder[]> {
  return db
    .select({ id: deadlines.id, title: deadlines.title, profile: sources.profile })
    .from(deadlines)
    .leftJoin(sources, eq(deadlines.sourceId, sources.id))
    .where(
      and(
        isNull(deadlines.remindedAt),
        eq(deadlines.dismissed, false),
        gt(deadlines.dueAt, now),
        lte(deadlines.dueAt, new Date(now.getTime() + REMINDER_WINDOW_MS)),
        or(
          inArray(deadlines.progress, ["todo", "ongoing"]),
          and(isNull(deadlines.progress), eq(deadlines.done, false)),
        ),
      ),
    )
    .orderBy(deadlines.dueAt);
}

export function buildReminder(items: DueReminder[]): { title: string; body: string; url: string; tag: string } {
  const shown = items
    .slice(0, 3)
    .map((i) => i.title)
    .join(", ");
  const more = items.length - 3;
  return {
    title: `${items.length} deadline trong 24h tới`,
    body: more > 0 ? `${shown} và ${more} việc khác` : shown,
    url: items.every((i) => i.profile === "work") ? "/work" : "/",
    tag: "deadline-reminder",
  };
}

/** Sends one grouped push for newly-due deadlines, then marks them reminded. Returns how many were included. */
export async function sendDeadlineReminders(db: Db, now = new Date()): Promise<number> {
  if (!isPushConfigured()) return 0;
  const items = await selectDueReminders(db, now);
  if (items.length === 0) return 0;
  const res = await sendPush(buildReminder(items));
  // Nothing delivered (no devices, or all failed): keep them pending for the next run.
  if (res.sent === 0) return 0;
  await db
    .update(deadlines)
    .set({ remindedAt: now })
    .where(inArray(deadlines.id, items.map((i) => i.id)));
  return items.length;
}

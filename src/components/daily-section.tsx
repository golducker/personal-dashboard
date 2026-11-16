import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyItems, dailyLog } from "@/db/schema";
import { XP_PER_TICK } from "@/lib/daily";
import { dayKey } from "@/lib/time";
import { DailyChecklist } from "./daily-checklist";

export async function DailySection() {
  const db = await getDb();
  const today = dayKey(new Date());
  const [items, doneRows, [total]] = await Promise.all([
    db.select({ id: dailyItems.id, title: dailyItems.title }).from(dailyItems).orderBy(asc(dailyItems.createdAt)),
    db.select({ itemId: dailyLog.itemId }).from(dailyLog).where(eq(dailyLog.day, today)),
    db.select({ n: count() }).from(dailyLog),
  ]);
  const done = new Set(doneRows.map((r) => r.itemId));
  return <DailyChecklist key={today} items={items.map((i) => ({ ...i, done: done.has(i.id) }))} xp={total.n * XP_PER_TICK} />;
}

import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyItems, dailyLog } from "@/db/schema";
import { streakBefore } from "@/lib/daily";
import { dayKey } from "@/lib/time";
import { DailyChecklist } from "./daily-checklist";

export async function DailySection() {
  const db = await getDb();
  const today = dayKey(new Date());
  // shortcut: reads the whole log (a few rows a day), add a day lower bound if it ever gets slow
  const [items, log] = await Promise.all([
    db.select({ id: dailyItems.id, title: dailyItems.title, createdAt: dailyItems.createdAt }).from(dailyItems).orderBy(asc(dailyItems.createdAt)),
    db.select({ itemId: dailyLog.itemId, day: dailyLog.day }).from(dailyLog),
  ]);
  const doneToday = new Set(log.filter((r) => r.day === today).map((r) => r.itemId));
  const streak = streakBefore(items.map((i) => ({ id: i.id, createdDay: dayKey(i.createdAt) })), log, today);
  return (
    <DailyChecklist
      key={today}
      items={items.map((i) => ({ id: i.id, title: i.title, done: doneToday.has(i.id) }))}
      streakBefore={streak}
    />
  );
}

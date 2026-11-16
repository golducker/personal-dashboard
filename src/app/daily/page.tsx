import { asc, count, eq } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { DailyChecklist } from "@/components/daily-checklist";
import { getDb } from "@/db";
import { dailyItems, dailyLog } from "@/db/schema";
import { XP_PER_TICK } from "@/lib/daily";
import { dayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const db = await getDb();
  const today = dayKey(new Date());
  const [items, doneRows, [total]] = await Promise.all([
    db.select({ id: dailyItems.id, title: dailyItems.title }).from(dailyItems).orderBy(asc(dailyItems.createdAt)),
    db.select({ itemId: dailyLog.itemId }).from(dailyLog).where(eq(dailyLog.day, today)),
    db.select({ n: count() }).from(dailyLog),
  ]);
  const done = new Set(doneRows.map((r) => r.itemId));

  return (
    <div className="page-pad mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6">
      <AppHeader title="Hằng ngày" subtitle="Danh sách tự làm mới mỗi ngày. Tick để lên cấp." />
      <DailyChecklist key={today} items={items.map((i) => ({ ...i, done: done.has(i.id) }))} xp={total.n * XP_PER_TICK} />
    </div>
  );
}

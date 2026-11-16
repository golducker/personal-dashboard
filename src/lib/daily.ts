import { addDays } from "./time";

export type DailyItem = { id: string; title: string; done: boolean };

/**
 * Consecutive fully-done days ending yesterday. A day counts when every item that existed by then was ticked;
 * today is added on the client once its bar fills, so an unfinished today never breaks the streak.
 */
export function streakBefore(items: Array<{ id: string; createdDay: string }>, log: Array<{ itemId: string; day: string }>, today: string): number {
  const byDay = new Map<string, Set<string>>();
  for (const r of log) byDay.set(r.day, (byDay.get(r.day) ?? new Set()).add(r.itemId));
  let n = 0;
  for (let day = addDays(today, -1); ; day = addDays(day, -1)) {
    const due = items.filter((i) => i.createdDay <= day);
    const done = byDay.get(day);
    if (due.length === 0 || !done || !due.every((i) => done.has(i.id))) return n;
    n++;
  }
}

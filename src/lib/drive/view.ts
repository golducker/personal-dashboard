import { addDays, dayKey } from "@/lib/time";
import { fold } from "./text";

export type DeadlineRow = {
  id: string;
  title: string;
  dueAt: Date | null;
  assignee: string | null;
  status: string | null;
  done: boolean;
  link: string | null;
  groupLabel: string | null;
  groupDate: Date | null;
  fileId: string;
  profile: string;
};

/** "A · B", "A, B", "A/B" -> ["A", "B"]. */
export function splitAssignees(text: string | null): string[] {
  if (!text) return [];
  return [...new Set(text.split(/[·,;/+&\n]/).map((s) => s.trim()).filter(Boolean))];
}

const dueDay = (r: DeadlineRow) => (r.dueAt ? dayKey(r.dueAt) : null);

export function isOverdue(r: DeadlineRow, today: string): boolean {
  const d = dueDay(r);
  return !r.done && d !== null && d < today;
}

const byDue = (a: DeadlineRow, b: DeadlineRow) =>
  (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.title.localeCompare(b.title, "vi");

export type EventGroup = { key: string; label: string; date: Date | null; tasks: DeadlineRow[] };

/** Rows grouped by event (label + date), events by date then label, tasks by due; undated tasks split out. */
export function groupByEvent(rows: DeadlineRow[], showDone: boolean): { groups: EventGroup[]; undated: DeadlineRow[] } {
  const map = new Map<string, EventGroup>();
  const undated: DeadlineRow[] = [];
  for (const r of rows) {
    if (r.done && !showDone) continue;
    if (!r.dueAt) {
      undated.push(r);
      continue;
    }
    const label = r.groupLabel ?? "Không rõ sự kiện";
    const key = `${label}|${r.groupDate?.toISOString() ?? ""}`;
    const g = map.get(key) ?? { key, label, date: r.groupDate, tasks: [] };
    g.tasks.push(r);
    map.set(key, g);
  }
  const groups = [...map.values()];
  for (const g of groups) g.tasks.sort(byDue);
  groups.sort(
    (a, b) =>
      (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) ||
      (a.tasks[0].dueAt!.getTime() - b.tasks[0].dueAt!.getTime()) ||
      a.label.localeCompare(b.label, "vi"),
  );
  return { groups, undated: undated.sort(byDue) };
}

export type WorkFilters = { assignee?: string; project?: string; status?: string };

export function applyFilters(rows: DeadlineRow[], f: WorkFilters): DeadlineRow[] {
  return rows.filter((r) => {
    if (f.project && (r.groupLabel ?? "") !== f.project) return false;
    if (f.assignee && !splitAssignees(r.assignee).includes(f.assignee)) return false;
    if (f.status === "open" && r.done) return false;
    if (f.status === "done" && !r.done) return false;
    if (f.status && f.status !== "open" && f.status !== "done" && fold(r.status ?? "") !== fold(f.status)) return false;
    return true;
  });
}

export type TimelineDay = { day: string; isToday: boolean; tasks: DeadlineRow[] };

export type Timeline = {
  /** Not done and due before today, whatever the window. */
  overdue: DeadlineRow[];
  days: TimelineDay[];
};

/** `count` days from `startDay`; undone tasks from before today are pinned in `overdue`, not repeated in the days. */
export function buildTimeline(rows: DeadlineRow[], startDay: string, count: number, today: string): Timeline {
  const overdue = rows.filter((r) => isOverdue(r, today)).sort(byDue);
  const days: TimelineDay[] = [];
  for (let i = 0; i < count; i++) {
    const day = addDays(startDay, i);
    const tasks = rows.filter((r) => dueDay(r) === day && !isOverdue(r, today)).sort(byDue);
    days.push({ day, isToday: day === today, tasks });
  }
  return { overdue, days };
}

export type Progress = { name: string; done: number; total: number; percent: number };

function tally(rows: DeadlineRow[], keys: (r: DeadlineRow) => string[]): Progress[] {
  const map = new Map<string, { done: number; total: number }>();
  for (const r of rows) {
    for (const k of keys(r)) {
      const v = map.get(k) ?? { done: 0, total: 0 };
      v.total++;
      if (r.done) v.done++;
      map.set(k, v);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v, percent: Math.round((v.done / v.total) * 100) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}

export const progressByProject = (rows: DeadlineRow[]) => tally(rows, (r) => [r.groupLabel ?? "Không rõ dự án"]);
export const progressByAssignee = (rows: DeadlineRow[]) => tally(rows, (r) => splitAssignees(r.assignee));

/** Week navigation: window start (a day key) for an offset in weeks from yesterday. */
export function windowStart(today: string, weekOffset: number): string {
  return addDays(today, -1 + 7 * weekOffset);
}

export function clampWeek(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) ? Math.max(-8, Math.min(2, n)) : 0;
}

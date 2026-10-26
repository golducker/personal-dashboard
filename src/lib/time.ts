export const TZ = "Asia/Ho_Chi_Minh";
// Việt Nam không có giờ mùa hè nên offset cố định +07:00.
const OFFSET = "+07:00";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** "YYYY-MM-DD" of an instant in Asia/Ho_Chi_Minh. */
export function dayKey(d: Date | string): string {
  return dayFmt.format(typeof d === "string" ? new Date(d) : d);
}

/** "HH:mm" of an instant in Asia/Ho_Chi_Minh. */
export function timeLabel(d: Date | string): string {
  return timeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Start of the given local day as a UTC instant. */
export function startOfDay(key: string): Date {
  return new Date(`${key}T00:00:00${OFFSET}`);
}

export function localDateTime(date: string, time: string): string {
  return `${date}T${time}:00${OFFSET}`;
}

const headFmt = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

export function formatLongDate(d: Date = new Date()): string {
  return headFmt.format(d);
}

/** "T2, 26/10"-style label for a "YYYY-MM-DD" key. */
export function formatDayKey(key: string): string {
  return shortFmt.format(new Date(`${key}T00:00:00Z`));
}

export type DayEntry = { start: string; end: string; allDay: boolean };

/**
 * Days (YYYY-MM-DD, Asia/Ho_Chi_Minh) an event occupies. All-day events use date strings
 * with an exclusive end (Google convention); timed events count on the day they start.
 */
export function eventDays(e: DayEntry): string[] {
  if (!e.allDay) return [dayKey(e.start)];
  const days: string[] = [];
  for (let d = e.start, i = 0; d < e.end && i < 62; d = addDays(d, 1), i++) days.push(d);
  return days.length ? days : [e.start];
}

/** Groups events by local day, all-day events first then by start time; keys sorted ascending. */
export function groupByDay<T extends DayEntry>(events: T[]): Array<{ day: string; events: T[] }> {
  const map = new Map<string, T[]>();
  for (const e of events) {
    for (const day of eventDays(e)) {
      const list = map.get(day) ?? [];
      list.push(e);
      map.set(day, list);
    }
  }
  return [...map.keys()].sort().map((day) => ({
    day,
    events: map.get(day)!.sort((a, b) =>
      a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : Date.parse(a.start) - Date.parse(b.start),
    ),
  }));
}

import { localDateTime } from "@/lib/time";

const DATE_RE = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}(?![\d/.-])))?/g;

export type ParsedDay = { day: string; hasYear: boolean };

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * All dates in a free-text cell, in order ("01/10 - 04/10/2026", "Trước 15/10/2026").
 * A date without a year takes the year of the next dated item in the same text, else `defaultYear`.
 */
export function extractDays(text: string, defaultYear: number): ParsedDay[] {
  const raw: { d: number; m: number; y: number | null }[] = [];
  for (const mt of text.matchAll(DATE_RE)) {
    let y: number | null = null;
    if (mt[3]) y = mt[3].length === 2 ? 2000 + Number(mt[3]) : Number(mt[3]);
    raw.push({ d: Number(mt[1]), m: Number(mt[2]), y });
  }
  const out: ParsedDay[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    let y = r.y;
    if (y === null) {
      const next = raw.slice(i + 1).find((x) => x.y !== null);
      y = next?.y ?? defaultYear;
    }
    if (!valid(y, r.m, r.d)) continue;
    out.push({
      day: `${y}-${String(r.m).padStart(2, "0")}-${String(r.d).padStart(2, "0")}`,
      hasYear: r.y !== null,
    });
  }
  return out;
}

/** Last date of a cell as a due instant (end of day, Asia/Ho_Chi_Minh), or null. */
export function parseDue(text: string, defaultYear: number): Date | null {
  const days = extractDays(text, defaultYear);
  const last = days[days.length - 1];
  return last ? new Date(localDateTime(last.day, "23:59")) : null;
}

/** First "HH:mm" / "HHhmm" / "HH:mm - HH:mm" start time in a cell, normalised to "HH:mm". */
export function parseTimeOfDay(text: string): string | null {
  const m = text.match(/(\d{1,2})\s*[:h]\s*(\d{2})?/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

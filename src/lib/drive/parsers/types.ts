export type ParsedDeadline = {
  rowKey: string;
  title: string;
  dueAt: Date | null;
  rawText: string;
  assignee: string | null;
  status: string | null;
  done: boolean;
  link: string | null;
  groupLabel: string | null;
  groupDate: Date | null;
};

/** Sheet tab name -> rows of cell text. */
export type TabValues = Record<string, string[][]>;

/** Returns `base`, or `base#2`, `base#3`... when it was already used. */
export function uniqueKey(base: string, seen: Set<string>): string {
  let key = base;
  for (let n = 2; seen.has(key); n++) key = `${base}#${n}`;
  seen.add(key);
  return key;
}

export type HeaderHit = { index: number; folded: string[] };

/** First row for which `accept` is true; folded cells are passed to `accept`. */
export function findHeaderRow(rows: string[][], accept: (folded: string[]) => boolean, fold: (s: string) => string): HeaderHit | null {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const folded = (rows[i] ?? []).map((c) => fold((c ?? "").toString()));
    if (accept(folded)) return { index: i, folded };
  }
  return null;
}

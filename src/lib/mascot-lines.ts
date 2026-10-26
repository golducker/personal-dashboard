// Plain summary shown in the hero speech bubble (same text in both themes).

export type LineContext = { overdue: number | null; today: number | null };

/** "2 việc quá hạn · 3 việc đến hạn hôm nay"; null when the numbers are unavailable. */
export function summaryLine({ overdue, today }: LineContext): string | null {
  if (overdue === null || today === null) return null;
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} việc quá hạn`);
  if (today > 0) parts.push(`${today} việc đến hạn hôm nay`);
  return parts.length ? parts.join(" · ") : "Hôm nay không còn việc nào.";
}

export const XP_PER_TICK = 10;

/** Level L -> L+1 costs 50*L XP, so each level takes a little longer. */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, xp);
  while (left >= 50 * level) left -= 50 * level++;
  return { level, into: left, need: 50 * level };
}

export type DailyItem = { id: string; title: string; done: boolean };

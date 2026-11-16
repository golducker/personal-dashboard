import { expect, test } from "vitest";
import { streakBefore } from "./daily";

const items = [
  { id: "a", createdDay: "2026-11-10" },
  { id: "b", createdDay: "2026-11-13" },
];
const log = (pairs: string[]) => pairs.map((p) => ({ itemId: p.split("@")[0], day: p.split("@")[1] }));

test("streakBefore counts full days ending yesterday", () => {
  const today = "2026-11-16";
  expect(streakBefore(items, [], today)).toBe(0);
  // 12th only needs a (b did not exist yet); 15th misses b, so the streak is broken there
  expect(streakBefore(items, log(["a@2026-11-12", "a@2026-11-13", "b@2026-11-13", "a@2026-11-14", "b@2026-11-14", "a@2026-11-15"]), today)).toBe(0);
  expect(streakBefore(items, log(["a@2026-11-12", "a@2026-11-13", "b@2026-11-13", "a@2026-11-14", "b@2026-11-14", "a@2026-11-15", "b@2026-11-15"]), today)).toBe(4);
  // today's ticks don't count here
  expect(streakBefore(items, log(["a@2026-11-16", "b@2026-11-16"]), today)).toBe(0);
});

test("streakBefore stops when no items existed", () => {
  expect(streakBefore([{ id: "a", createdDay: "2026-11-15" }], log(["a@2026-11-15", "a@2026-11-14"]), "2026-11-16")).toBe(1);
});

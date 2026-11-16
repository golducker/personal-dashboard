import { expect, test } from "vitest";
import { levelOf } from "./daily";

test("levelOf", () => {
  expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 50 });
  expect(levelOf(49)).toEqual({ level: 1, into: 49, need: 50 });
  expect(levelOf(50)).toEqual({ level: 2, into: 0, need: 100 });
  expect(levelOf(160)).toEqual({ level: 3, into: 10, need: 150 });
});

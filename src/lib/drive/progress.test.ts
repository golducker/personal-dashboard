import { describe, expect, it } from "vitest";
import {
  MAX_BULK,
  bulkProgressSchema,
  effectiveProgress,
  isEffectivelyDone,
  progressSchema,
  readProgress,
  updateProgressSchema,
} from "./progress";

describe("progress helpers", () => {
  it("validates states", () => {
    expect(progressSchema.safeParse("ongoing").success).toBe(true);
    expect(progressSchema.safeParse("finished").success).toBe(false);
    expect(updateProgressSchema.parse({ progress: null })).toEqual({ progress: null });
    expect(updateProgressSchema.safeParse({}).success).toBe(false);
  });

  it("user progress wins over the sheet", () => {
    expect(effectiveProgress(null, true)).toBe("done");
    expect(effectiveProgress(null, false)).toBe("todo");
    expect(effectiveProgress("ongoing", true)).toBe("ongoing");
    expect(isEffectivelyDone("todo", true)).toBe(false);
    expect(isEffectivelyDone("done", false)).toBe(true);
    expect(isEffectivelyDone(null, true)).toBe(true);
  });

  it("validates bulk updates", () => {
    const id = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
    expect(bulkProgressSchema.parse({ items: [{ id, progress: "done" }, { id, progress: null }] }).items).toHaveLength(2);
    expect(bulkProgressSchema.safeParse({ items: [] }).success).toBe(false);
    expect(bulkProgressSchema.safeParse({ items: [{ id: "nope", progress: "done" }] }).success).toBe(false);
    expect(bulkProgressSchema.safeParse({ items: [{ id, progress: "finished" }] }).success).toBe(false);
    const many = Array.from({ length: MAX_BULK + 1 }, () => ({ id, progress: "done" }));
    expect(bulkProgressSchema.safeParse({ items: many }).success).toBe(false);
  });

  it("ignores unknown stored values", () => {
    expect(readProgress("postponed")).toBe("postponed");
    expect(readProgress("weird")).toBeNull();
    expect(readProgress(null)).toBeNull();
  });
});

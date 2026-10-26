import { describe, expect, it } from "vitest";
import { effectiveProgress, isEffectivelyDone, progressSchema, readProgress, updateProgressSchema } from "./progress";

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

  it("ignores unknown stored values", () => {
    expect(readProgress("postponed")).toBe("postponed");
    expect(readProgress("weird")).toBeNull();
    expect(readProgress(null)).toBeNull();
  });
});

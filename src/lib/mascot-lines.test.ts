import { describe, expect, it } from "vitest";
import { summaryLine } from "./mascot-lines";

describe("summaryLine", () => {
  it("joins overdue and due-today counts", () => {
    expect(summaryLine({ overdue: 2, today: 3 })).toBe("2 việc quá hạn · 3 việc đến hạn hôm nay");
    expect(summaryLine({ overdue: 1, today: 0 })).toBe("1 việc quá hạn");
    expect(summaryLine({ overdue: 0, today: 4 })).toBe("4 việc đến hạn hôm nay");
  });
  it("says the day is clear, or nothing without data", () => {
    expect(summaryLine({ overdue: 0, today: 0 })).toBe("Hôm nay không còn việc nào.");
    expect(summaryLine({ overdue: null, today: 2 })).toBeNull();
  });
});

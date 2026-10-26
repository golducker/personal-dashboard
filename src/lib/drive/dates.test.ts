import { describe, expect, it } from "vitest";
import { extractDays, parseDue, parseTimeOfDay } from "./dates";
import { fold, isDoneStatus } from "./text";

describe("extractDays", () => {
  it("reads single, prefixed and range dates", () => {
    expect(extractDays("15/10/2026", 2026).map((d) => d.day)).toEqual(["2026-10-15"]);
    expect(extractDays("Trước 15/10/2026", 2026).map((d) => d.day)).toEqual(["2026-10-15"]);
    expect(extractDays("01/10 - 04/10/2026", 2030).map((d) => d.day)).toEqual(["2026-10-01", "2026-10-04"]);
    expect(extractDays("01/10-04/10/2026", 2030).map((d) => d.day)).toEqual(["2026-10-01", "2026-10-04"]);
  });
  it("uses the default year when there is none", () => {
    expect(extractDays("01/10", 2027)).toEqual([{ day: "2027-10-01", hasYear: false }]);
  });
  it("ignores impossible dates and plain text", () => {
    expect(extractDays("31/02/2026", 2026)).toEqual([]);
    expect(extractDays("sớm nhất có thể", 2026)).toEqual([]);
  });
});

describe("parseDue", () => {
  it("uses the last date at 23:59 Vietnam time", () => {
    expect(parseDue("01/10 - 04/10/2026", 2026)?.toISOString()).toBe("2026-10-04T16:59:00.000Z");
    expect(parseDue("", 2026)).toBeNull();
  });
});

describe("parseTimeOfDay", () => {
  it("normalises times", () => {
    expect(parseTimeOfDay("9:30")).toBe("09:30");
    expect(parseTimeOfDay("14h")).toBe("14:00");
    expect(parseTimeOfDay("14h30 - 16h")).toBe("14:30");
    expect(parseTimeOfDay("Cả ngày")).toBeNull();
  });
});

describe("text helpers", () => {
  it("folds Vietnamese", () => {
    expect(fold("  Phân  Công ")).toBe("phan cong");
    expect(fold("Đã Hoàn Thành")).toBe("da hoan thanh");
  });
  it("detects done statuses", () => {
    expect(isDoneStatus("Hoàn thành")).toBe(true);
    expect(isDoneStatus("Xong")).toBe(true);
    expect(isDoneStatus("Chưa hoàn thành")).toBe(false);
    expect(isDoneStatus("Đang làm")).toBe(false);
    expect(isDoneStatus("")).toBe(false);
  });
});

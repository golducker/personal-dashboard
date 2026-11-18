import { describe, expect, it } from "vitest";
import { taskBlock } from "./calendar";

describe("taskBlock", () => {
  it("skips date-only dues", () => {
    expect(taskBlock("2026-11-18")).toBeNull();
  });
  it("uses the end time, or 30 minutes", () => {
    expect(taskBlock("2026-11-18T09:00:00", "10:30")).toEqual({
      start: "2026-11-18T09:00:00+07:00",
      end: "2026-11-18T10:30:00+07:00",
    });
    expect(Date.parse(taskBlock("2026-11-18T09:00:00")!.end)).toBe(Date.parse("2026-11-18T09:30:00+07:00"));
  });
  it("reads UTC instants in Vietnam time and wraps past midnight", () => {
    expect(taskBlock("2026-11-18T16:00:00Z", "00:30")).toEqual({
      start: "2026-11-18T23:00:00+07:00",
      end: "2026-11-19T00:30:00+07:00",
    });
  });
});

import { dedupeEvents, type CalEvent } from "./calendar";

describe("dedupeEvents", () => {
  const ev = (id: string, calendarId: string) => ({ id, calendarId }) as CalEvent;
  it("keeps the non-primary copy of an event that sits in two calendars", () => {
    const out = dedupeEvents([ev("a", "me"), ev("a", "work"), ev("b", "me"), ev("c", "work"), ev("c", "me")], "me");
    expect(out.map((e) => `${e.id}:${e.calendarId}`).sort()).toEqual(["a:work", "b:me", "c:work"]);
  });
});

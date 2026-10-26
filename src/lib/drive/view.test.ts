import { describe, expect, it } from "vitest";
import {
  applyFilters,
  isOverdue,
  buildTimeline,
  clampWeek,
  groupByEvent,
  progressByAssignee,
  progressByProject,
  splitAssignees,
  windowStart,
  type DeadlineRow,
} from "./view";

let n = 0;
function row(p: Partial<DeadlineRow>): DeadlineRow {
  return {
    id: String(++n), title: `T${n}`, dueAt: null, assignee: null, status: null, done: false, progress: null, sheetDone: false, link: null,
    groupLabel: null, groupDate: null, fileId: "f", profile: "work", ...p,
  };
}
const at = (iso: string) => new Date(`${iso}T12:00:00+07:00`);

describe("work view helpers", () => {
  const rows = [
    row({ title: "late", dueAt: at("2026-10-24"), assignee: "An · Bình", groupLabel: "P1" }),
    row({ title: "late done", dueAt: at("2026-10-24"), assignee: "An", groupLabel: "P1", done: true, status: "Done" }),
    row({ title: "today", dueAt: at("2026-10-26"), assignee: "Bình", groupLabel: "P2", status: "Đang làm" }),
    row({ title: "later", dueAt: at("2026-10-28"), assignee: "An, Chi", groupLabel: "P2" }),
    row({ title: "undated", groupLabel: "P2" }),
  ];

  it("splits assignees", () => {
    expect(splitAssignees("An · Bình, Chi / An")).toEqual(["An", "Bình", "Chi"]);
    expect(splitAssignees(null)).toEqual([]);
  });

  it("pins undone overdue tasks and lists the rest by day", () => {
    const t = buildTimeline(rows, windowStart("2026-10-26", 0), 7, "2026-10-26");
    expect(t.overdue.map((r) => r.title)).toEqual(["late"]);
    expect(t.days[0].day).toBe("2026-10-25");
    expect(t.days[1]).toMatchObject({ day: "2026-10-26", isToday: true });
    expect(t.days[1].tasks.map((r) => r.title)).toEqual(["today"]);
    expect(t.days[3].tasks.map((r) => r.title)).toEqual(["later"]);
  });

  it("filters", () => {
    expect(applyFilters(rows, { assignee: "An" }).map((r) => r.title)).toEqual(["late", "late done", "later"]);
    expect(applyFilters(rows, { project: "P2", status: "open" }).map((r) => r.title)).toEqual(["today", "later", "undated"]);
    expect(applyFilters(rows, { status: "done" }).map((r) => r.title)).toEqual(["late done"]);
    expect(applyFilters(rows, { status: "Đang làm" }).map((r) => r.title)).toEqual(["today"]);
  });

  it("computes progress per project and assignee", () => {
    expect(progressByProject(rows)).toEqual([
      { name: "P2", done: 0, total: 3, percent: 0 },
      { name: "P1", done: 1, total: 2, percent: 50 },
    ]);
    expect(progressByAssignee(rows).find((p) => p.name === "An")).toEqual({ name: "An", done: 1, total: 3, percent: 33 });
  });

  it("clamps week offsets", () => {
    expect(clampWeek("1")).toBe(1);
    expect(clampWeek("99")).toBe(2);
    expect(clampWeek("abc")).toBe(0);
    expect(clampWeek(undefined)).toBe(0);
  });
});

describe("progress in views", () => {
  const today = "2026-10-26";
  const late = at("2026-10-24");

  it("does not flag postponed tasks as overdue", () => {
    expect(isOverdue(row({ dueAt: late }), today)).toBe(true);
    expect(isOverdue(row({ dueAt: late, progress: "postponed" }), today)).toBe(false);
    expect(isOverdue(row({ dueAt: late, progress: "ongoing" }), today)).toBe(true);
    expect(buildTimeline([row({ dueAt: late, progress: "postponed" })], "2026-10-25", 7, today).overdue).toEqual([]);
  });

  it("filters on effective progress", () => {
    const rows = [
      row({ title: "plain" }),
      row({ title: "sheet done", sheetDone: true, done: true }),
      row({ title: "going", progress: "ongoing" }),
      row({ title: "later", progress: "postponed" }),
      row({ title: "reopened", progress: "todo", sheetDone: true }),
    ];
    const f = (status: string) => applyFilters(rows, { status }).map((r) => r.title);
    expect(f("p:todo")).toEqual(["plain", "reopened"]);
    expect(f("p:ongoing")).toEqual(["going"]);
    expect(f("p:postponed")).toEqual(["later"]);
    expect(f("done")).toEqual(["sheet done"]);
  });
});

describe("groupByEvent", () => {
  it("groups by event, hides done, splits undated", () => {
    const d1 = at("2026-11-20");
    const d2 = at("2026-11-05");
    const rows = [
      row({ title: "a2", dueAt: at("2026-10-20"), groupLabel: "Alpha", groupDate: d1 }),
      row({ title: "a1", dueAt: at("2026-10-10"), groupLabel: "Alpha", groupDate: d1 }),
      row({ title: "b1", dueAt: at("2026-10-12"), groupLabel: "Beta", groupDate: d2 }),
      row({ title: "gone", dueAt: at("2026-10-12"), groupLabel: "Beta", groupDate: d2, done: true }),
      row({ title: "none", groupLabel: "Beta", groupDate: d2 }),
    ];
    const g = groupByEvent(rows, false);
    expect(g.groups.map((x) => x.label)).toEqual(["Beta", "Alpha"]);
    expect(g.groups[1].tasks.map((r) => r.title)).toEqual(["a1", "a2"]);
    expect(g.groups[0].tasks.map((r) => r.title)).toEqual(["b1"]);
    expect(g.undated.map((r) => r.title)).toEqual(["none"]);
    expect(groupByEvent(rows, true).groups[0].tasks).toHaveLength(2);
  });
});

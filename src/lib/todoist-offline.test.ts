import { describe, expect, it } from "vitest";
import { applyOverlay, estimateDue, runOutbox, type Executor, type OutboxRow } from "./todoist-offline";
import { TodoistError, TodoistUnavailableError, type TodoTask } from "./todoist";

// 2026-10-28 is a Wednesday (Asia/Ho_Chi_Minh).
const NOW = new Date("2026-10-28T05:00:00Z");

describe("estimateDue", () => {
  const d = (s: string) => estimateDue(s, NOW).date;
  it("handles relative days", () => {
    expect(d("hôm nay")).toBe("2026-10-28");
    expect(d("mai")).toBe("2026-10-29");
    expect(d("ngày kia")).toBe("2026-10-30");
    expect(d("3 ngày nữa")).toBe("2026-10-31");
    expect(d("tuần sau")).toBe("2026-11-04");
  });
  it("handles weekdays strictly after today", () => {
    expect(d("thứ 6")).toBe("2026-10-30");
    expect(d("thứ 4")).toBe("2026-11-04");
    expect(d("chủ nhật")).toBe("2026-11-01");
  });
  it("handles explicit dates", () => {
    expect(d("5/11")).toBe("2026-11-05");
    expect(d("1/10")).toBe("2027-10-01");
    expect(d("27/12/2026")).toBe("2026-12-27");
  });
  it("adds floating time", () => {
    expect(d("mai 9h30")).toBe("2026-10-29T09:30:00");
    expect(d("tối nay")).toBe("2026-10-28T20:00:00");
  });
  it("falls back to today and keeps the original string", () => {
    expect(estimateDue("không hiểu", NOW)).toEqual({ date: "2026-10-28", string: "không hiểu", recurring: false });
  });
});

const task = (id: string, date: string, extra: Partial<TodoTask> = {}): TodoTask => ({
  id, content: id, description: "", projectId: "", priority: 1, labels: [], url: "",
  due: { date, string: date, recurring: false }, ...extra,
});

describe("applyOverlay", () => {
  const cache = { now: [task("a", "2026-10-28")], upcoming: [task("a", "2026-10-28"), task("b", "2026-10-30")] };
  const ids = (r: ReturnType<typeof applyOverlay>) => r.tasks.map((t) => t.id).sort();

  it("close removes, reopen restores", () => {
    expect(ids(applyOverlay(cache, [{ op: "close", taskId: "a", payload: null }], NOW))).toEqual(["b"]);
    const r = applyOverlay(cache, [{ op: "close", taskId: "a", payload: null }, { op: "reopen", taskId: "a", payload: null }], NOW);
    expect(ids(r)).toEqual(["a", "b"]);
  });
  it("create adds an optimistic task, update patches it", () => {
    const r = applyOverlay(
      cache,
      [
        { op: "create", taskId: "local_1", payload: { content: "mới", due_string: "mai", priority: 3 } },
        { op: "update", taskId: "local_1", payload: { content: "mới 2" } },
        { op: "update", taskId: "b", payload: { due_string: "hôm nay" } },
      ],
      NOW,
    );
    const n = r.tasks.find((t) => t.id === "local_1")!;
    expect(n).toMatchObject({ content: "mới 2", priority: 3, due: { date: "2026-10-29" } });
    expect(r.tasks.find((t) => t.id === "b")!.due!.date).toBe("2026-10-28");
    expect([...r.pendingIds].sort()).toEqual(["b", "local_1"]);
  });
});

const row = (seq: number, op: OutboxRow["op"], taskId: string, payload: OutboxRow["payload"] = null): OutboxRow => ({ id: String(seq), seq, op, taskId, payload });

function fake(failOn?: (call: string) => Error | undefined) {
  const calls: string[] = [];
  const run = (c: string) => {
    calls.push(c);
    const e = failOn?.(c);
    if (e) throw e;
  };
  const exec: Executor = {
    create: async (p) => (run(`create:${p.content}`), { id: "real_1" }),
    update: async (id) => run(`update:${id}`),
    close: async (id) => run(`close:${id}`),
    reopen: async (id) => run(`reopen:${id}`),
  };
  return { exec, calls };
}

describe("runOutbox", () => {
  it("replays in order and remaps local ids", async () => {
    const { exec, calls } = fake();
    const done: Array<[string, string | undefined]> = [];
    const r = await runOutbox(
      [row(1, "create", "local_x", { content: "A" }), row(2, "update", "local_x", { content: "B" }), row(3, "close", "local_x"), row(4, "close", "t9")],
      exec,
      { done: (rw, real) => void done.push([rw.id, real]) },
    );
    expect(calls).toEqual(["create:A", "update:real_1", "close:real_1", "close:t9"]);
    expect(done[0]).toEqual(["1", "real_1"]);
    expect(r).toEqual({ done: 4, dropped: 0, stopped: false });
  });
  it("stops on unavailable and keeps the rest", async () => {
    const { exec, calls } = fake((c) => (c === "close:t2" ? new TodoistUnavailableError(503) : undefined));
    const stopped: string[] = [];
    const r = await runOutbox([row(1, "close", "t1"), row(2, "close", "t2"), row(3, "close", "t3")], exec, { stopped: (rw) => void stopped.push(rw.id) });
    expect(calls).toEqual(["close:t1", "close:t2"]);
    expect(stopped).toEqual(["2"]);
    expect(r).toEqual({ done: 1, dropped: 0, stopped: true });
  });
  it("drops 4xx rows and continues; ops on a dropped create are dropped too", async () => {
    const { exec, calls } = fake((c) => (c.startsWith("create") ? new TodoistError(400, "bad") : undefined));
    const dropped: string[] = [];
    const r = await runOutbox([row(1, "create", "local_x", { content: "A" }), row(2, "close", "local_x"), row(3, "close", "t3")], exec, { dropped: (rw) => void dropped.push(rw.id) });
    expect(calls).toEqual(["create:A", "close:t3"]);
    expect(dropped).toEqual(["1", "2"]);
    expect(r).toEqual({ done: 1, dropped: 2, stopped: false });
  });
});

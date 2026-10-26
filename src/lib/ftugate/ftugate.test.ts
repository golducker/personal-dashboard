import { describe, expect, it } from "vitest";
import { diffGrades, gradeOf } from "./grades-diff";
import { normalizeGrades, type NormalizedGrades } from "./grades";
import { hashValue, stableStringify } from "./hash";
import { buildGradesMessage, ftugateBodySchema } from "./sync";
import { escapeHtml } from "../telegram";

const fixture = {
  grades: {
    ds_diem_hocky: [
      {
        hoc_ky: "20251",
        ten_hoc_ky: "Học kỳ 1 - Năm học 2025-2026",
        dtb_hk_he10: "8.1",
        dtb_hk_he4: 3.4,
        dtb_tich_luy_he_10: "",
        dtb_tich_luy_he_4: "3.30",
        so_tin_chi_dat_tich_luy: 15,
        ds_diem_mon_hoc: [
          { ma_mon: "AAA100", ten_mon: "Môn A", so_tin_chi: "3", diem_tk: "8.5", diem_tk_so: "3.5", diem_tk_chu: "B+" },
          {
            ma_mon: "BBB200",
            ten_mon: "Môn B",
            so_tin_chi: 2,
            diem_tk: "",
            diem_tk_so: null,
            diem_tk_chu: "",
            diem_giua_ky: "",
            ds_diem_thanh_phan: [{ ky_hieu: "C1", ten_thanh_phan: "Giữa kỳ", trong_so: "30", diem_thanh_phan: "" }],
          },
        ],
      },
      { hoc_ky: "20261", ten_hoc_ky: "Học kỳ 1 - Năm học 2026-2027", ds_diem_mon_hoc: [] },
    ],
  },
};

function norm(v: unknown): NormalizedGrades {
  const n = normalizeGrades(v);
  if (!n) throw new Error("fixture should normalize");
  return n;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe("hash", () => {
  it("is stable under key reordering", () => {
    const a = { x: 1, y: { b: [1, { d: 4, c: 3 }], a: "s" } };
    const b = { y: { a: "s", b: [1, { c: 3, d: 4 }] }, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(hashValue(a)).toBe(hashValue(b));
    expect(hashValue(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashValue({ x: 2 })).not.toBe(hashValue({ x: 1 }));
  });
});

describe("normalizeGrades", () => {
  it("handles strings, numbers and empty values", () => {
    const n = norm(fixture);
    expect(n.semesters.map((s) => s.code)).toEqual(["20261", "20251"]);
    const sem = n.semesters[1];
    expect(sem).toMatchObject({ code: "20251", gpa10: 8.1, gpa4: 3.4, cumGpa10: null, cumGpa4: 3.3, cumCredits: 15 });
    expect(sem.courses[0]).toEqual({
      code: "AAA100",
      name: "Môn A",
      credits: 3,
      score10: 8.5,
      score4: 3.5,
      letter: "B+",
      midterm: null,
      exam: null,
      components: [],
    });
    expect(sem.courses[1]).toMatchObject({ credits: 2, score10: null, score4: null, letter: null, midterm: null });
    expect(sem.courses[1].components).toEqual([{ code: "C1", name: "Giữa kỳ", weight: 30, score: null }]);
  });
  it("returns null on garbage", () => {
    expect(normalizeGrades(null)).toBeNull();
    expect(normalizeGrades("x")).toBeNull();
    expect(normalizeGrades({ grades: { foo: 1 } })).toBeNull();
    expect(normalizeGrades({ grades: { ds_diem_hocky: [1] } })).toBeNull();
    expect(normalizeGrades({ grades: { ds_diem_hocky: [{ hoc_ky: "1", ds_diem_mon_hoc: "no" }] } })).toBeNull();
  });
});

describe("diffGrades", () => {
  it("baseline returns nothing", () => {
    expect(diffGrades(null, norm(fixture))).toEqual([]);
  });
  it("detects a newly graded course", () => {
    const prev = norm(fixture);
    const next = clone(prev);
    next.semesters[1].courses[1] = { ...next.semesters[1].courses[1], score10: 7, score4: 3, letter: "B" };
    const d = diffGrades(prev, next);
    expect(d).toHaveLength(1);
    expect(d[0].semester).toBe("20251");
    expect(d[0].course.code).toBe("BBB200");
  });
  it("detects a changed score and ignores unchanged ones", () => {
    const prev = norm(fixture);
    const next = clone(prev);
    next.semesters[1].courses[0].score10 = 9;
    const d = diffGrades(prev, next);
    expect(d.map((c) => c.course.code)).toEqual(["AAA100"]);
    expect(diffGrades(prev, clone(prev))).toEqual([]);
  });
  it("ignores ungraded courses, including new ones", () => {
    const prev = norm(fixture);
    const next = clone(prev);
    next.semesters[1].courses.push({ code: "CCC300", name: "C", credits: 3, score10: null, score4: null, letter: null, midterm: null, exam: null, components: [] });
    expect(diffGrades(prev, next)).toEqual([]);
  });
  it("detects a new component score before the final grade", () => {
    const prev = norm(fixture);
    const next = clone(prev);
    next.semesters[1].courses[1].components[0].score = 8;
    const d = diffGrades(prev, next);
    expect(d.map((c) => c.course.code)).toEqual(["BBB200"]);
    expect(buildGradesMessage([{ courseCode: "BBB200", courseName: "Môn B", score: gradeOf(d[0].course) }], 3.3)).toBe(
      "🎓 <b>Có điểm mới</b>\n• BBB200 Môn B: Giữa kỳ 8\nGPA tích lũy (hệ 4): 3.3",
    );
  });
  it("ignores removed courses", () => {
    const prev = norm(fixture);
    const next = clone(prev);
    next.semesters[1].courses.shift();
    expect(diffGrades(prev, next)).toEqual([]);
  });
});

describe("body schema", () => {
  it("accepts snapshots and errors, rejects the rest", () => {
    expect(ftugateBodySchema.safeParse({ snapshots: [{ kind: "grades", payload: {} }] }).success).toBe(true);
    expect(ftugateBodySchema.safeParse({ error: "captcha" }).success).toBe(true);
    expect(ftugateBodySchema.safeParse({ error: "nope" }).success).toBe(false);
    expect(ftugateBodySchema.safeParse({ snapshots: [] }).success).toBe(false);
    expect(
      ftugateBodySchema.safeParse({
        snapshots: [
          { kind: "grades", payload: {} },
          { kind: "grades", payload: {} },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("escapes the Telegram HTML specials", () => {
    expect(escapeHtml("a <b> & c")).toBe("a &lt;b&gt; &amp; c");
  });
});

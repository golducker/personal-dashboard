import type { NormalizedCourse, NormalizedGrades } from "./grades";
import { stableStringify } from "./hash";

export type GradeChange = {
  semester: string;
  course: NormalizedCourse;
};

/** Everything that counts as "a grade": final scores plus midterm/exam/component scores. */
export function gradeOf(c: NormalizedCourse) {
  return {
    score10: c.score10,
    score4: c.score4,
    letter: c.letter,
    midterm: c.midterm,
    exam: c.exam,
    components: c.components.filter((p) => p.score !== null).map((p) => ({ code: p.code, name: p.name, score: p.score })),
  };
}

function hasGrade(c: NormalizedCourse): boolean {
  const g = gradeOf(c);
  return g.score10 !== null || g.score4 !== null || !!g.letter || g.midterm !== null || g.exam !== null || g.components.length > 0;
}

function scoreKey(c: NormalizedCourse): string {
  return stableStringify(gradeOf(c));
}

/** Courses that newly have a grade, or whose grade changed. prev === null is a baseline: no changes. */
export function diffGrades(prev: NormalizedGrades | null, next: NormalizedGrades): GradeChange[] {
  if (!prev) return [];
  const old = new Map<string, NormalizedCourse>();
  for (const s of prev.semesters) for (const c of s.courses) old.set(`${s.code}|${c.code}`, c);

  const changes: GradeChange[] = [];
  for (const s of next.semesters) {
    for (const c of s.courses) {
      if (!hasGrade(c)) continue;
      const before = old.get(`${s.code}|${c.code}`);
      if (!before || !hasGrade(before) || scoreKey(before) !== scoreKey(c)) {
        changes.push({ semester: s.code, course: c });
      }
    }
  }
  return changes;
}

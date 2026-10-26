// All knowledge of the eduSoft grades payload lives here. Adjust the field names
// below once a real payload has been seen.

export type NormalizedCourse = {
  code: string;
  name: string;
  credits: number | null;
  score10: number | null;
  score4: number | null;
  letter: string | null;
  midterm: number | null;
  exam: number | null;
  /** Component scores (chuyên cần, giữa kỳ…) that show up during the semester, before the final grade. */
  components: NormalizedComponent[];
};

export type NormalizedComponent = {
  code: string;
  name: string;
  weight: number | null;
  score: number | null;
};

export type NormalizedSemester = {
  code: string;
  name: string;
  gpa10: number | null;
  gpa4: number | null;
  cumGpa10: number | null;
  cumGpa4: number | null;
  cumCredits: number | null;
  courses: NormalizedCourse[];
};

export type NormalizedGrades = { semesters: NormalizedSemester[] };

const F = {
  list: "ds_diem_hocky",
  semCode: "hoc_ky",
  semName: "ten_hoc_ky",
  gpa10: "dtb_hk_he10",
  gpa4: "dtb_hk_he4",
  cumGpa10: "dtb_tich_luy_he_10",
  cumGpa4: "dtb_tich_luy_he_4",
  cumCredits: "so_tin_chi_dat_tich_luy",
  courses: "ds_diem_mon_hoc",
  courseCode: "ma_mon",
  courseName: "ten_mon",
  credits: "so_tin_chi",
  score10: "diem_tk",
  score4: "diem_tk_so",
  letter: "diem_tk_chu",
  midterm: "diem_giua_ky",
  exam: "diem_thi",
  components: "ds_diem_thanh_phan",
  compCode: "ky_hieu",
  compName: "ten_thanh_phan",
  compWeight: "trong_so",
  compScore: "diem_thanh_phan",
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Takes the grades payload (`{ grades }` map or the inner response data). Null when the shape is unrecognised. */
export function normalizeGrades(payload: unknown): NormalizedGrades | null {
  const root = isRecord(payload) && "grades" in payload ? payload.grades : payload;
  if (!isRecord(root)) return null;
  const list = root[F.list];
  if (!Array.isArray(list)) return null;

  const semesters: NormalizedSemester[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) return null;
    const code = str(raw[F.semCode]);
    if (!code) return null;
    const rawCourses = raw[F.courses];
    if (rawCourses != null && !Array.isArray(rawCourses)) return null;
    const courses: NormalizedCourse[] = [];
    for (const c of (rawCourses as unknown[] | null | undefined) ?? []) {
      if (!isRecord(c)) return null;
      const courseCode = str(c[F.courseCode]);
      if (!courseCode) return null;
      const rawComponents = c[F.components];
      if (rawComponents != null && !Array.isArray(rawComponents)) return null;
      const components: NormalizedComponent[] = [];
      for (const p of (rawComponents as unknown[] | null | undefined) ?? []) {
        if (!isRecord(p)) return null;
        const name = str(p[F.compName]) ?? str(p[F.compCode]) ?? "?";
        components.push({ code: str(p[F.compCode]) ?? name, name, weight: num(p[F.compWeight]), score: num(p[F.compScore]) });
      }
      courses.push({
        code: courseCode,
        name: str(c[F.courseName]) ?? courseCode,
        credits: num(c[F.credits]),
        score10: num(c[F.score10]),
        score4: num(c[F.score4]),
        letter: str(c[F.letter]),
        midterm: num(c[F.midterm]),
        exam: num(c[F.exam]),
        components,
      });
    }
    semesters.push({
      code,
      name: str(raw[F.semName]) ?? code,
      gpa10: num(raw[F.gpa10]),
      gpa4: num(raw[F.gpa4]),
      cumGpa10: num(raw[F.cumGpa10]),
      cumGpa4: num(raw[F.cumGpa4]),
      cumCredits: num(raw[F.cumCredits]),
      courses,
    });
  }
  // newest first (FTUgate already sends them that way; codes are like "20261")
  semesters.sort((a, b) => b.code.localeCompare(a.code));
  return { semesters };
}

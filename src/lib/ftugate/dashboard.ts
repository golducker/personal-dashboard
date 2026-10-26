import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { FTU_KINDS, ftuSnapshots, gradeEvents, type FtuKind } from "@/db/schema";
import { dayKey } from "@/lib/time";
import { normalizeGrades, type NormalizedGrades } from "./grades";
import { examsView, noticesView, weekView, type ExamView, type NoticeView, type WeekView } from "./view";

export type FtuData = {
  week: WeekView | null;
  exams: ExamView[];
  grades: NormalizedGrades | null;
  notices: NoticeView[];
  /** "semester|courseCode" of grades that changed in the last 7 days. */
  recentGrades: Set<string>;
  hasAny: boolean;
};

/** Latest snapshot of each FTUgate kind, shaped for the dashboard. */
export async function getFtuData(now: Date = new Date()): Promise<FtuData> {
  const db = await getDb();
  const latest = await Promise.all(
    FTU_KINDS.map(async (kind) => {
      const [row] = await db
        .select({ payload: ftuSnapshots.payload })
        .from(ftuSnapshots)
        .where(eq(ftuSnapshots.kind, kind))
        .orderBy(desc(ftuSnapshots.fetchedAt))
        .limit(1);
      return [kind, row?.payload ?? null] as const;
    }),
  );
  const payload = Object.fromEntries(latest) as Record<FtuKind, unknown>;
  const recent = await db
    .select({ semester: gradeEvents.semester, code: gradeEvents.courseCode })
    .from(gradeEvents)
    .where(gte(gradeEvents.detectedAt, new Date(now.getTime() - 7 * 86_400_000)));

  const today = dayKey(now);
  return {
    week: weekView(payload.schedule, today),
    exams: examsView(payload.exams, today),
    grades: payload.grades ? normalizeGrades(payload.grades) : null,
    notices: noticesView(payload.notices),
    recentGrades: new Set(recent.map((r) => `${r.semester}|${r.code}`)),
    hasAny: latest.some(([, p]) => p !== null),
  };
}

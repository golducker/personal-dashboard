import { z } from "zod";
import { desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { FTU_KINDS, ftuSnapshots, gradeEvents, syncRuns, type FtuKind } from "@/db/schema";
import { sendPushSafe } from "@/lib/push";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { diffGrades, gradeOf, type GradeChange } from "./grades-diff";
import { normalizeGrades, type NormalizedGrades } from "./grades";
import { hashValue } from "./hash";

export const MAX_BODY_BYTES = 3 * 1024 * 1024;
export const MAX_SNAPSHOTS_PER_KIND = 30;

export const SCRAPER_ERRORS = ["login_failed", "captcha", "timeout", "bad_response", "unknown"] as const;

const snapshotSchema = z.object({
  kind: z.enum(FTU_KINDS),
  payload: z.record(z.string(), z.unknown()),
});

export const ftugateBodySchema = z.union([
  z.object({
    snapshots: z
      .array(snapshotSchema)
      .min(1)
      .max(4)
      .refine((a) => new Set(a.map((s) => s.kind)).size === a.length, "duplicate kind"),
  }),
  z.object({ error: z.enum(SCRAPER_ERRORS) }),
]);

export type FtugateBody = z.infer<typeof ftugateBodySchema>;

export type FtugateResult = {
  ok: boolean;
  stored: FtuKind[];
  unchanged: FtuKind[];
  newGrades: number;
  notified: number;
};

type Db = Awaited<ReturnType<typeof getDb>>;

async function latestRun(db: Db) {
  const [row] = await db
    .select({ status: syncRuns.status })
    .from(syncRuns)
    .where(eq(syncRuns.source, "ftugate"))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);
  return row ?? null;
}

async function writeRun(db: Db, startedAt: Date, status: "success" | "error", items: number, error?: string) {
  await db.insert(syncRuns).values({
    source: "ftugate",
    startedAt,
    finishedAt: new Date(),
    status,
    itemsCount: items,
    error: error ?? null,
  });
}

async function prune(db: Db, kind: FtuKind) {
  const old = await db
    .select({ id: ftuSnapshots.id })
    .from(ftuSnapshots)
    .where(eq(ftuSnapshots.kind, kind))
    .orderBy(desc(ftuSnapshots.fetchedAt))
    .offset(MAX_SNAPSHOTS_PER_KIND);
  if (old.length > 0) {
    await db.delete(ftuSnapshots).where(
      inArray(
        ftuSnapshots.id,
        old.map((o) => o.id),
      ),
    );
  }
}

type StoredScore = Partial<ReturnType<typeof gradeOf>>;

function fmtScore(s: StoredScore): string {
  const main = s.score10 ?? s.score4;
  if (main !== null && main !== undefined) {
    return s.letter ? `${main} (${escapeHtml(s.letter)})` : String(main);
  }
  // no final grade yet: list the partial scores
  const parts = (s.components ?? []).map((p) => `${escapeHtml(p.name)} ${p.score}`);
  if (parts.length === 0 && s.midterm != null) parts.push(`Giữa kỳ ${s.midterm}`);
  if (s.exam != null) parts.push(`Thi ${s.exam}`);
  return parts.join(", ") || "?";
}

export function buildGradesMessage(
  events: { courseCode: string; courseName: string; score: unknown }[],
  cumGpa4: number | null,
): string {
  const lines = events.map((e) => {
    const sc = (e.score ?? {}) as StoredScore;
    return `• ${escapeHtml(e.courseCode)} ${escapeHtml(e.courseName)}: ${fmtScore(sc)}`;
  });
  let text = `🎓 <b>Có điểm mới</b>\n${lines.join("\n")}`;
  if (cumGpa4 !== null) text += `\nGPA tích lũy (hệ 4): ${cumGpa4}`;
  return text;
}

/** Short plain-text course list for the push body. */
export function buildGradesPushBody(events: { courseName: string }[]): string {
  const names = [...new Set(events.map((e) => e.courseName))];
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} và ${names.length - 3} môn khác` : shown;
}

function latestCumGpa4(g: NormalizedGrades | null): number | null {
  if (!g) return null;
  // semesters are newest first; the current one has no GPA yet
  return g.semesters.find((s) => s.cumGpa4 !== null)?.cumGpa4 ?? null;
}

/** Inserts new grade events and sends one Telegram message for every un-notified event. */
async function notifyGrades(db: Db, changes: GradeChange[], latest: NormalizedGrades | null) {
  let newGrades = 0;
  for (const ch of changes) {
    const score = gradeOf(ch.course);
    const inserted = await db
      .insert(gradeEvents)
      .values({
        courseCode: ch.course.code,
        courseName: ch.course.name,
        semester: ch.semester,
        score,
        scoreHash: hashValue(score),
      })
      .onConflictDoNothing()
      .returning({ id: gradeEvents.id });
    newGrades += inserted.length;
  }

  const pending = await db.select().from(gradeEvents).where(isNull(gradeEvents.notifiedAt));
  if (pending.length === 0) return { newGrades, notified: 0 };

  const [sent] = await Promise.all([
    sendTelegram(buildGradesMessage(pending, latestCumGpa4(latest))),
    sendPushSafe({ title: "Có điểm mới", body: buildGradesPushBody(pending), url: "/", tag: "grades" }),
  ]);
  if (!sent) return { newGrades, notified: 0 };
  await db
    .update(gradeEvents)
    .set({ notifiedAt: new Date() })
    .where(
      inArray(
        gradeEvents.id,
        pending.map((p) => p.id),
      ),
    );
  return { newGrades, notified: pending.length };
}

export async function handleFtugate(body: FtugateBody): Promise<{ status: number; result: FtugateResult }> {
  const db = await getDb();
  const startedAt = new Date();
  const prevRun = await latestRun(db);
  const result: FtugateResult = { ok: true, stored: [], unchanged: [], newGrades: 0, notified: 0 };

  if ("error" in body) {
    await writeRun(db, startedAt, "error", 0, body.error);
    if (prevRun?.status === "success") {
      await Promise.all([
        sendTelegram(`⚠️ <b>FTUgate sync lỗi</b>: ${escapeHtml(body.error)}`),
        sendPushSafe({ title: "Đồng bộ lỗi", body: `FTUgate: ${body.error}`, url: "/health", tag: "sync-ftugate" }),
      ]);
    }
    return { status: 200, result };
  }

  let badResponse = false;
  let gradeChanges: GradeChange[] = [];
  let latestGrades: NormalizedGrades | null = null;

  for (const snap of body.snapshots) {
    const normalized = snap.kind === "grades" ? normalizeGrades(snap.payload) : null;
    if (snap.kind === "grades" && !normalized) {
      badResponse = true;
      continue;
    }
    const hash = hashValue(snap.kind === "grades" ? normalized : snap.payload);

    const [last] = await db
      .select({ contentHash: ftuSnapshots.contentHash, payload: ftuSnapshots.payload })
      .from(ftuSnapshots)
      .where(eq(ftuSnapshots.kind, snap.kind))
      .orderBy(desc(ftuSnapshots.fetchedAt))
      .limit(1);

    if (snap.kind === "grades") latestGrades = normalized;
    if (last?.contentHash === hash) {
      result.unchanged.push(snap.kind);
      continue;
    }

    await db.insert(ftuSnapshots).values({ kind: snap.kind, contentHash: hash, payload: snap.payload });
    await prune(db, snap.kind);
    result.stored.push(snap.kind);

    if (snap.kind === "grades" && normalized) {
      const prev = last ? normalizeGrades(last.payload) : null;
      gradeChanges = diffGrades(prev, normalized);
    }
  }

  // Always run: retries events whose Telegram message failed earlier.
  const n = await notifyGrades(db, gradeChanges, latestGrades);
  result.newGrades = n.newGrades;
  result.notified = n.notified;

  if (badResponse) {
    result.ok = false;
    await writeRun(db, startedAt, "error", result.stored.length, "bad_response");
    if (prevRun?.status === "success") {
      await Promise.all([
        sendTelegram(`⚠️ <b>FTUgate sync lỗi</b>: bad_response`),
        sendPushSafe({ title: "Đồng bộ lỗi", body: "FTUgate: bad_response", url: "/health", tag: "sync-ftugate" }),
      ]);
    }
    return { status: 422, result };
  }

  await writeRun(db, startedAt, "success", result.stored.length);
  if (prevRun?.status === "error") {
    await Promise.all([
      sendTelegram("✅ <b>FTUgate sync hồi phục</b>"),
      sendPushSafe({ title: "Đồng bộ đã hồi phục", body: "FTUgate hoạt động lại bình thường.", url: "/health", tag: "sync-ftugate" }),
    ]);
  }
  return { status: 200, result };
}

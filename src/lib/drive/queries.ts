import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines, files, sources } from "@/db/schema";
import { MIME_FOLDER } from "./client";
import { isEffectivelyDone, readProgress } from "./progress";
import type { DeadlineRow } from "./view";

type Profile = typeof sources.$inferSelect.profile;

/** Every live (not dismissed) deadline with its source profile. */
export async function loadDeadlines(profile?: Profile): Promise<DeadlineRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: deadlines.id,
      title: deadlines.title,
      dueAt: deadlines.dueAt,
      assignee: deadlines.assignee,
      status: deadlines.status,
      sheetDone: deadlines.done,
      progress: deadlines.progress,
      link: deadlines.link,
      groupLabel: deadlines.groupLabel,
      groupDate: deadlines.groupDate,
      fileId: deadlines.fileId,
      profile: sources.profile,
    })
    .from(deadlines)
    .innerJoin(sources, eq(deadlines.sourceId, sources.id))
    .where(and(eq(deadlines.dismissed, false), profile ? eq(sources.profile, profile) : undefined));
  return rows.map(({ progress: raw, ...r }) => {
    const progress = readProgress(raw);
    return { ...r, progress, done: isEffectivelyDone(progress, r.sheetDone) };
  });
}

export type RecentFile = { id: string; name: string; mimeType: string; path: string; modifiedTime: Date | null; profile: Profile };

/** The most recently modified non-folder files, optionally of one profile. */
export async function loadRecentFiles(profile?: Profile, limit = 10): Promise<RecentFile[]> {
  const db = await getDb();
  return db
    .select({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      path: files.path,
      modifiedTime: files.modifiedTime,
      profile: sources.profile,
    })
    .from(files)
    .innerJoin(sources, eq(files.sourceId, sources.id))
    .where(and(ne(files.mimeType, MIME_FOLDER), profile ? eq(sources.profile, profile) : undefined))
    .orderBy(sql`${files.modifiedTime} desc nulls last`)
    .limit(limit);
}

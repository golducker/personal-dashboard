import { z } from "zod";

/** The user's own progress on a deadline, stored only in our DB (Drive is read-only). */
export const PROGRESS_VALUES = ["todo", "ongoing", "done", "postponed"] as const;
export type ProgressState = (typeof PROGRESS_VALUES)[number];

export const progressSchema = z.enum(PROGRESS_VALUES);

export const PROGRESS_LABELS: Record<ProgressState, string> = {
  todo: "Chưa làm",
  ongoing: "Đang làm",
  done: "Xong",
  postponed: "Hoãn",
};

/** `null` means the user has not set anything: fall back to the sheet. */
export type ProgressInput = ProgressState | null;

export const updateProgressSchema = z.object({ progress: progressSchema.nullable() });

/** Many deadlines at once (mark a whole event done, or undo that). Each item carries its own value so undo can restore mixed states. */
export const MAX_BULK = 200;
export const bulkProgressSchema = z.object({
  items: z
    .array(z.object({ id: z.uuid(), progress: progressSchema.nullable() }))
    .min(1)
    .max(MAX_BULK),
});

/** What the dashboard treats the task as: the user's choice wins over the sheet. */
export function effectiveProgress(progress: ProgressState | null, sheetDone: boolean): ProgressState {
  return progress ?? (sheetDone ? "done" : "todo");
}

export const isEffectivelyDone = (progress: ProgressState | null, sheetDone: boolean) =>
  effectiveProgress(progress, sheetDone) === "done";

/** Parses a stored value, ignoring anything unknown. */
export function readProgress(raw: string | null | undefined): ProgressState | null {
  const r = progressSchema.safeParse(raw);
  return r.success ? r.data : null;
}

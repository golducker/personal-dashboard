import { z } from "zod";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isInstant = (s: string) => /T/.test(s) && !Number.isNaN(Date.parse(s));

type RawTimes = { allDay: boolean; start: string; end?: string };

/** All-day uses dates (end = inclusive last day, defaults to start); timed uses ISO instants. Returns an error message or the times. */
export function checkTimes(t: RawTimes): { error: string } | { times: { allDay: boolean; start: string; end: string } } {
  const end = t.end ?? (t.allDay ? t.start : "");
  const valid = t.allDay ? DATE.test(t.start) && DATE.test(end) : isInstant(t.start) && isInstant(end);
  if (!valid) return { error: "Thời gian bắt đầu/kết thúc không hợp lệ" };
  const bad = t.allDay ? end < t.start : Date.parse(end) <= Date.parse(t.start);
  if (bad) return { error: "Kết thúc phải sau bắt đầu" };
  return { times: { allDay: t.allDay, start: t.start, end } };
}

const timesFields = { allDay: z.boolean().default(false), start: z.string(), end: z.string().optional() };
const text = (max: number) => z.string().trim().max(max);

export const createEventSchema = z
  .object({
    title: text(300).min(1, "Thiếu tiêu đề"),
    calendarId: z.string().min(1).optional(),
    location: text(500).optional(),
    description: text(8000).optional(),
    ...timesFields,
  })
  .transform((v, ctx) => {
    const r = checkTimes(v);
    if ("error" in r) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    const rest = { title: v.title, calendarId: v.calendarId, location: v.location, description: v.description };
    return { ...rest, ...r.times };
  });

export const patchEventSchema = z
  .object({
    title: text(300).min(1).optional(),
    location: text(500).optional(),
    description: text(8000).optional(),
    times: z.object(timesFields).optional(),
  })
  .transform((v, ctx) => {
    const { times, ...rest } = v;
    if (!times) return { ...rest, times: undefined };
    const r = checkTimes(times);
    if ("error" in r) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return { ...rest, times: r.times };
  });

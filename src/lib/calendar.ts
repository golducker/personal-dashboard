import { googleFetch } from "./google";
import { recordRun } from "./run-log";
import { TZ, addDays } from "./time";

const BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarInfo = { id: string; name: string; color: string; primary: boolean; selected: boolean; writable: boolean };

/** start/end: ISO datetime for timed events; "YYYY-MM-DD" for all-day (end is exclusive, Google convention). */
export type CalEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  color: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  description: string | null;
};

type GCalendar = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
};
type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  location?: string;
  htmlLink?: string;
  description?: string;
};

export function normalizeCalendar(c: GCalendar): CalendarInfo {
  return {
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor || "#4285f4",
    primary: !!c.primary,
    selected: !!c.selected,
    writable: c.accessRole === "owner" || c.accessRole === "writer",
  };
}

export function normalizeEvent(e: GEvent, cal: Pick<CalendarInfo, "id" | "name" | "color">): CalEvent | null {
  if (e.status === "cancelled" || !e.start) return null;
  const allDay = !!e.start.date && !e.start.dateTime;
  const start = e.start.dateTime ?? e.start.date!;
  const end = e.end?.dateTime ?? e.end?.date ?? (allDay ? addDays(start, 1) : start);
  return {
    id: e.id,
    calendarId: cal.id,
    calendarName: cal.name,
    color: cal.color,
    title: e.summary?.trim() || "(Không tiêu đề)",
    start,
    end,
    allDay,
    location: e.location || null,
    htmlLink: e.htmlLink || null,
    description: e.description || null,
  };
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const data = await googleFetch<{ items?: GCalendar[] }>(`${BASE}/users/me/calendarList?minAccessRole=reader`);
  return (data?.items ?? []).map(normalizeCalendar);
}

/** Events across all selected calendars between `from` and `to` (ISO instants). */
export function listEvents(from: string, to: string): Promise<CalEvent[]> {
  return recordRun("google_calendar", async () => {
    const calendars = (await listCalendars()).filter((c) => c.selected);
    const results = await Promise.allSettled(
      calendars.map(async (cal) => {
        const qs = new URLSearchParams({
          timeMin: from,
          timeMax: to,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
          timeZone: TZ,
        });
        const data = await googleFetch<{ items?: GEvent[] }>(`${BASE}/calendars/${encodeURIComponent(cal.id)}/events?${qs}`);
        return (data?.items ?? []).map((e) => normalizeEvent(e, cal)).filter((e): e is CalEvent => !!e);
      }),
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    // Auth problems affect every calendar; surface them instead of returning an empty list.
    const auth = failed.find((r) => (r.reason as Error)?.name === "GoogleNotConnectedError");
    if (auth) throw auth.reason;
    if (failed.length && failed.length === results.length) throw failed[0].reason;
    return results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  });
}

export type EventTimes = { allDay: boolean; start: string; end: string };
export type EventInput = EventTimes & { title: string; calendarId?: string; location?: string; description?: string };

/** For all-day input, `end` is the inclusive last day; Google wants it exclusive. */
function timesBody(t: EventTimes) {
  return t.allDay
    ? { start: { date: t.start, dateTime: null }, end: { date: addDays(t.end, 1), dateTime: null } }
    : { start: { dateTime: t.start, timeZone: TZ, date: null }, end: { dateTime: t.end, timeZone: TZ, date: null } };
}

export async function createEvent(input: EventInput, calendars?: CalendarInfo[]): Promise<CalEvent> {
  const calendarId = input.calendarId || "primary";
  const body = {
    summary: input.title,
    location: input.location || undefined,
    description: input.description || undefined,
    ...timesBody(input),
  };
  const e = await googleFetch<GEvent>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const cal = calendars?.find((c) => c.id === calendarId);
  return normalizeEvent(e!, { id: calendarId, name: cal?.name ?? calendarId, color: cal?.color ?? "#4285f4" })!;
}

export type EventPatch = { title?: string; location?: string; description?: string; times?: EventTimes };

export async function updateEvent(calendarId: string, eventId: string, patch: EventPatch): Promise<CalEvent> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.summary = patch.title;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.times) Object.assign(body, timesBody(patch.times));
  const e = await googleFetch<GEvent>(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return normalizeEvent(e!, { id: calendarId, name: calendarId, color: "#4285f4" })!;
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await googleFetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

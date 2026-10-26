import { cache } from "react";
import { listCalendars, listEvents } from "@/lib/calendar";
import { loadDeadlines } from "@/lib/drive/queries";
import { addDays, startOfDay } from "@/lib/time";
import { load } from "@/lib/today";

/** Per-request memoised loaders, so the hero and the panels share one query. */
export const getDeadlines = cache(() => loadDeadlines());

export const getCalendarWindow = cache((today: string) =>
  load(async () => {
    const [events, calendars] = await Promise.all([
      listEvents(startOfDay(today).toISOString(), startOfDay(addDays(today, 8)).toISOString()),
      listCalendars(),
    ]);
    return { events, calendars };
  }),
);

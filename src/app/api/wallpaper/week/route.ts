import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { safeEqual } from "@/lib/auth";
import { listCalendars, listEvents } from "@/lib/calendar";
import { addDays, dayKey, groupByDay, startOfDay, timeLabel, weekStart } from "@/lib/time";

export const dynamic = "force-dynamic";

// Read-only week view for the lock-screen wallpaper. The wallpaper is rendered by a
// third-party screenshot service that has no session cookie, so this path is public in
// proxy.ts and gated by WALLPAPER_KEY instead. Query-string key (not a header) keeps the
// browser fetch a "simple" CORS request with no preflight.
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const secret = process.env.WALLPAPER_KEY;
  if (!secret || !safeEqual(p.get("key") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }
  const date = p.get("date");
  const today = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dayKey(new Date());
  const mon = weekStart(today);
  try {
    const [events, calendars] = await Promise.all([
      listEvents(startOfDay(mon).toISOString(), startOfDay(addDays(mon, 7)).toISOString()),
      listCalendars(),
    ]);
    const byDay = new Map(groupByDay(events).map((g) => [g.day, g.events]));
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(mon, i);
      return {
        day,
        events: (byDay.get(day) ?? []).map((e) => ({
          title: e.title,
          calendar: e.calendarName,
          color: e.color,
          allDay: e.allDay,
          start: e.allDay ? null : timeLabel(e.start),
          end: e.allDay ? null : timeLabel(e.end),
        })),
      };
    });
    // Legend for the wallpaper: one entry per calendar shown, in the colors set in Settings.
    const legend = calendars.filter((c) => c.selected).map((c) => ({ name: c.name, color: c.color }));
    return NextResponse.json({ today, calendars: legend, days }, { headers: CORS });
  } catch (e) {
    const res = apiError(e);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }
}

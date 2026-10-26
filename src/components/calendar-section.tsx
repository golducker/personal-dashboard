import { listCalendars, listEvents } from "@/lib/calendar";
import { addDays, dayKey, formatDayKey, groupByDay, startOfDay } from "@/lib/time";
import { load, toEventView } from "@/lib/today";
import { AddEventForm } from "./add-event-form";
import { CARD, SectionTitle, SourceProblem } from "./card";
import { EventItem } from "./event-item";

export async function CalendarSection() {
  const today = dayKey(new Date());
  const result = await load(async () => {
    const [events, calendars] = await Promise.all([
      listEvents(startOfDay(today).toISOString(), startOfDay(addDays(today, 8)).toISOString()),
      listCalendars(),
    ]);
    return { events, calendars };
  });

  if (!result.ok) {
    return (
      <section className="space-y-3">
        <SectionTitle>Lịch hôm nay</SectionTitle>
        <SourceProblem failure={result} name="Google" />
      </section>
    );
  }

  const { events, calendars } = result.data;
  const days = groupByDay(events.map((e) => ({ ...e, view: toEventView(e) })));
  const todayEvents = days.find((d) => d.day === today)?.events ?? [];
  const upcoming = days.filter((d) => d.day > today);
  const options = calendars.filter((c) => c.writable).map((c) => ({ id: c.id, name: c.name, primary: c.primary }));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Lịch hôm nay</SectionTitle>
      </div>
      <div className={`${CARD} space-y-3 p-4`}>
        {todayEvents.length ? (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {todayEvents.map((e) => (
              <EventItem key={`${e.calendarId}:${e.id}`} event={e.view} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Không có sự kiện nào hôm nay.</p>
        )}
        <AddEventForm calendars={options} today={today} />
      </div>

      {upcoming.length > 0 && (
        <details className={`${CARD} group p-4`}>
          <summary className="cursor-pointer text-sm font-medium">
            7 ngày tới <span className="font-normal text-neutral-500">({upcoming.reduce((n, d) => n + d.events.length, 0)})</span>
          </summary>
          <div className="mt-3 space-y-3">
            {upcoming.map((d) => (
              <div key={d.day}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{formatDayKey(d.day)}</h3>
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {d.events.map((e) => (
                    <EventItem key={`${e.calendarId}:${e.id}:${d.day}`} event={e.view} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

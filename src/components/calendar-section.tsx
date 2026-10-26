import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { listCalendars, listEvents } from "@/lib/calendar";
import { addDays, dayKey, formatDayKey, groupByDay, startOfDay } from "@/lib/time";
import { load, toEventView } from "@/lib/today";
import { AddEventForm } from "./add-event-form";
import { Empty, Panel, SourceProblem } from "./card";
import { EventItem } from "./event-item";

export async function CalendarSection({ className }: { className?: string }) {
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
      <Panel title="Lịch hôm nay" icon={<CalendarBlank />} className={className}>
        <SourceProblem failure={result} name="Google" />
      </Panel>
    );
  }

  const { events, calendars } = result.data;
  const days = groupByDay(events.map((e) => ({ ...e, view: toEventView(e) })));
  const todayEvents = days.find((d) => d.day === today)?.events ?? [];
  const upcoming = days.filter((d) => d.day > today);
  const upcomingCount = upcoming.reduce((n, d) => n + d.events.length, 0);
  const options = calendars.filter((c) => c.writable).map((c) => ({ id: c.id, name: c.name, primary: c.primary }));

  return (
    <Panel
      title="Lịch hôm nay"
      icon={<CalendarBlank />}
      meta={todayEvents.length ? `${todayEvents.length} sự kiện` : undefined}
      className={className}
    >
      <div className="space-y-3">
        {todayEvents.length ? (
          <ul className="-mx-2 space-y-0.5">
            {todayEvents.map((e) => (
              <EventItem key={`${e.calendarId}:${e.id}`} event={e.view} />
            ))}
          </ul>
        ) : (
          <Empty>Hôm nay trống lịch.</Empty>
        )}
        <AddEventForm calendars={options} today={today} />

        {upcoming.length > 0 && (
          <details className="group border-t border-line pt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-2 hover:text-ink">
              7 ngày tới <span className="font-normal text-ink-3">({upcomingCount})</span>
            </summary>
            <div className="mt-3 space-y-4">
              {upcoming.map((d) => (
                <div key={d.day}>
                  <h3 className="mb-1 text-xs font-semibold text-ink-2 first-letter:uppercase">{formatDayKey(d.day)}</h3>
                  <ul className="-mx-2 space-y-0.5">
                    {d.events.map((e) => (
                      <EventItem key={`${e.calendarId}:${e.id}:${d.day}`} event={e.view} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </Panel>
  );
}

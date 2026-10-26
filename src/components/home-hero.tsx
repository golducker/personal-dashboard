import { getCalendarWindow, getDeadlines } from "@/lib/home-data";
import { summaryLine } from "@/lib/mascot-lines";
import { isOverdue } from "@/lib/drive/view";
import { dayKey, formatLongDate, groupByDay, timeLabel } from "@/lib/time";
import { CountUp } from "./count-up";
import { MascotSpeaker } from "./mascot-speaker";

type Stats = { dueToday: number | null; overdue: number | null; events: number | null };

function greeting(hour: number): string {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

async function loadStats(): Promise<Stats> {
  const today = dayKey(new Date());
  const [deadlines, calendar] = await Promise.all([getDeadlines().catch(() => null), getCalendarWindow(today).catch(() => null)]);
  let dueToday: number | null = null;
  let overdue: number | null = null;
  if (deadlines) {
    overdue = deadlines.filter((r) => isOverdue(r, today)).length;
    dueToday = deadlines.filter((r) => !r.done && r.progress !== "postponed" && r.dueAt && dayKey(r.dueAt) === today).length;
  }
  let events: number | null = null;
  if (calendar?.ok) {
    const days = groupByDay(calendar.data.events);
    events = days.find((d) => d.day === today)?.events.length ?? 0;
  }
  return { dueToday, overdue, events };
}

function Stat({ value, label, alarm = false }: { value: number | null; label: string; alarm?: boolean }) {
  // Only a non-zero overdue count earns colour; everything else stays ink so the alarm actually reads as one.
  const color = alarm && value ? "text-danger" : value ? "text-ink" : "text-ink-3";
  return (
    <div className="stat">
      <span className={`font-display tabular text-[30px] leading-none font-bold tracking-tight md:text-[40px] ${color}`}>
        {value === null ? <span aria-label="Không có dữ liệu">–</span> : <CountUp value={value} />}
      </span>
      <span className="mt-1.5 text-xs leading-4 text-ink-2 md:text-[13px]">{label}</span>
    </div>
  );
}

/** Greeting, date, mascot with speech bubble and three quick numbers. `stats` is null while they load. */
export function HeroView({ stats }: { stats: Stats | null }) {
  const now = new Date();
  const hour = Number(timeLabel(now).slice(0, 2));
  const date = formatLongDate(now);
  const line = summaryLine({ overdue: stats?.overdue ?? null, today: stats?.dueToday ?? null });
  const s = stats ?? { dueToday: null, overdue: null, events: null };

  return (
    <section className="hero-stage mb-6 pt-4 pb-6 md:mb-8 md:pt-8 md:pb-8" aria-label="Tổng quan hôm nay">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-8">
        <div className="col-start-1 row-start-1 min-w-0 space-y-2 self-start">
          <p className="text-sm font-medium text-ink-2 first-letter:uppercase">{date}</p>
          <h1 className="font-display text-[32px] leading-[1.02] font-bold tracking-[-0.03em] text-balance md:text-[56px]">
            {greeting(hour)},<br className="max-sm:hidden" /> Thịnh.
          </h1>
        </div>

        <MascotSpeaker
          line={line}
          size="lg"
          pose={s.overdue ? "panic" : "calm"}
          bubbleClassName="bubble-hero col-span-2 row-start-2 justify-self-end lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:self-center lg:justify-self-end"
          mascotClassName="justify-self-end col-start-2 row-start-1 max-md:[--ms:116px] md:max-lg:[--ms:160px] lg:col-start-3 lg:row-span-2"
        />

        {/* One ledger row, hairline-separated; three equal columns on phones so nothing wraps. */}
        <div className="col-span-2 row-start-3 grid grid-cols-3 sm:flex lg:col-span-1 lg:row-start-2">
          <Stat value={s.dueToday} label="deadline hôm nay" />
          <Stat value={s.overdue} label="quá hạn" alarm />
          <Stat value={s.events} label="lịch hôm nay" />
        </div>
      </div>
    </section>
  );
}

export async function HomeHero() {
  return <HeroView stats={await loadStats().catch(() => null)} />;
}

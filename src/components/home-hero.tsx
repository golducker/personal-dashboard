import { getCalendarWindow, getDeadlines } from "@/lib/home-data";
import { mascotLines } from "@/lib/mascot-lines";
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

function Chip({ value, label, tone }: { value: number | null; label: string; tone: "accent" | "danger" | "plain" }) {
  const color = tone === "danger" && value ? "text-danger" : tone === "accent" ? "text-accent-strong" : "text-ink";
  return (
    <div className={`stat-chip ${tone === "danger" && value ? "!border-danger/40" : ""}`}>
      <span className={`font-display text-[28px] leading-none font-extrabold md:text-[34px] ${color}`}>
        {value === null ? <span aria-label="Không có dữ liệu">–</span> : <CountUp value={value} />}
      </span>
      <span className="mt-1 text-xs leading-4 text-ink-2">{label}</span>
    </div>
  );
}

/** Greeting, date, mascot with speech bubble and three quick numbers. `stats` is null while they load. */
export function HeroView({ stats }: { stats: Stats | null }) {
  const now = new Date();
  const hour = Number(timeLabel(now).slice(0, 2));
  const date = formatLongDate(now);
  const lines = mascotLines({ overdue: stats?.overdue ?? null, today: stats?.dueToday ?? null, hour });
  const s = stats ?? { dueToday: null, overdue: null, events: null };

  return (
    <section className="hero-stage reveal mb-5 px-5 py-6 md:mb-6 md:px-9 md:py-8" aria-label="Tổng quan hôm nay">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-6">
        <div className="col-start-1 row-start-1 min-w-0 space-y-1.5 self-start">
          <p className="text-sm font-medium text-ink-2 first-letter:uppercase">{date}</p>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-tight text-balance md:text-[48px]">
            {greeting(hour)}, <span className="text-accent-strong">Thịnh.</span>
          </h1>
        </div>

        <MascotSpeaker
          lines={lines}
          size="lg"
          bubbleClassName="bubble-hero col-span-2 row-start-2 justify-self-end lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:self-center lg:justify-self-end"
          mascotClassName="justify-self-end col-start-2 row-start-1 max-md:[--ms:116px] md:max-lg:[--ms:160px] lg:col-start-3 lg:row-span-2"
        />

        {/* Three equal columns on phones so the chips never wrap to an orphan row. */}
        <div className="col-span-2 row-start-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2.5 lg:col-span-1 lg:row-start-2">
          <Chip value={s.dueToday} label="deadline hôm nay" tone="accent" />
          <Chip value={s.overdue} label="quá hạn" tone="danger" />
          <Chip value={s.events} label="lịch hôm nay" tone="plain" />
        </div>
      </div>
    </section>
  );
}

export async function HomeHero() {
  return <HeroView stats={await loadStats().catch(() => null)} />;
}

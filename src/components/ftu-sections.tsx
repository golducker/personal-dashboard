import { cache } from "react";
import Link from "next/link";
import { Chalkboard, Exam, GraduationCap, Megaphone } from "@phosphor-icons/react/dist/ssr";
import { getFtuData } from "@/lib/ftugate/dashboard";
import type { NormalizedCourse, NormalizedSemester } from "@/lib/ftugate/grades";
import { shortDayLabel, type ExamView } from "@/lib/ftugate/view";
import { Empty, Panel, Pill } from "./card";

// One DB read per request, shared by every FTU panel.
const loadFtu = cache(() => getFtuData());

function NoData() {
  return (
    <Empty>
      Chưa có dữ liệu FTUgate.{" "}
      <Link href="/health" className="font-medium text-accent-strong underline-offset-2 hover:underline">
        Xem tình trạng đồng bộ
      </Link>
    </Empty>
  );
}

export async function WeekSchedule({ className }: { className?: string }) {
  const { week, hasAny } = await loadFtu();
  const meta = week ? (week.semesterWeek ? `Tuần ${week.semesterWeek}, ${week.range}` : week.range) : undefined;
  const days = week?.days.filter((d) => d.classes.length > 0 || d.isToday) ?? [];

  return (
    <Panel title={week && !week.isCurrent ? "Thời khóa biểu tuần tới" : "Thời khóa biểu tuần này"} icon={<Chalkboard />} meta={meta} className={className}>
      {!week ? (
        hasAny ? <Empty>Chưa có thời khóa biểu cho học kỳ này.</Empty> : <NoData />
      ) : days.every((d) => d.classes.length === 0) ? (
        <Empty>Tuần này không có lớp.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {days.map((d) => (
            <div key={d.day} className={`rounded-xl p-3.5 ${d.isToday ? "bg-accent-soft" : "bg-surface-2"}`}>
              <p className="mb-2 flex items-center gap-2 text-sm">
                <span className={`font-semibold ${d.isToday ? "text-accent-strong" : ""}`}>{d.isToday ? "Hôm nay" : d.weekday}</span>
                <span className="text-ink-3">{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</span>
              </p>
              {d.classes.length === 0 ? (
                <p className="text-sm text-ink-2">Không có lớp.</p>
              ) : (
                <ul className="space-y-2.5">
                  {d.classes.map((c, i) => (
                    <li key={`${c.code}-${i}`} className="flex gap-3">
                      <span className="w-12 shrink-0 font-mono text-xs leading-5 text-ink-2">
                        {c.start}
                        <br />
                        <span className="text-ink-3">{c.end}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm leading-5 font-medium break-words">{c.name}</span>
                        <span className="block text-xs text-ink-2">
                          {c.room ?? "Chưa có phòng"}
                          {c.teacher ? `, ${c.teacher}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function countdown(e: ExamView) {
  if (e.daysLeft === 0) return <Pill tone="danger">Hôm nay</Pill>;
  if (e.daysLeft === 1) return <Pill tone="warn">Ngày mai</Pill>;
  return <Pill tone={e.daysLeft <= 7 ? "warn" : "neutral"}>Còn {e.daysLeft} ngày</Pill>;
}

export async function ExamList({ className }: { className?: string }) {
  const { exams, hasAny } = await loadFtu();
  return (
    <Panel title="Lịch thi" icon={<Exam />} meta={exams.length ? `${exams.length} môn` : undefined} className={className}>
      {!hasAny ? (
        <NoData />
      ) : exams.length === 0 ? (
        <Empty>Không có lịch thi sắp tới.</Empty>
      ) : (
        <ul className="space-y-4">
          {exams.slice(0, 5).map((e) => (
            <li key={`${e.code}-${e.day}-${e.time}`} className="flex gap-3">
              <span className="grid w-12 shrink-0 place-items-center rounded-lg bg-surface-2 py-1.5 text-center">
                <span className="font-mono text-lg leading-none font-semibold">{e.day.slice(8, 10)}</span>
                <span className="mt-0.5 text-[11px] text-ink-3">Th{Number(e.day.slice(5, 7))}</span>
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm leading-5 font-medium break-words">{e.name}</span>
                  {countdown(e)}
                </span>
                <span className="block text-xs text-ink-2">
                  {shortDayLabel(e.day)}
                  {e.time ? `, ${e.time}` : ""}
                  {e.minutes ? ` (${e.minutes} phút)` : ""}
                </span>
                {(e.room || e.format) && (
                  <span className="block text-xs text-ink-3">{[e.room, e.format].filter(Boolean).join(", ")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function hasScore(c: NormalizedCourse) {
  return c.score10 !== null || c.score4 !== null || c.midterm !== null || c.components.some((p) => p.score !== null);
}

function ScoreCell({ c }: { c: NormalizedCourse }) {
  if (c.score10 !== null) return <span className="font-mono font-semibold">{c.score10.toFixed(1)}</span>;
  const parts = c.components.filter((p) => p.score !== null);
  if (parts.length) {
    return (
      <span className="text-xs text-ink-2">
        {parts.map((p) => (
          <span key={p.code + p.name} className="block whitespace-nowrap">
            {p.name} <span className="font-mono text-ink">{p.score}</span>
          </span>
        ))}
      </span>
    );
  }
  if (c.midterm !== null) return <span className="text-xs text-ink-2">Giữa kỳ <span className="font-mono text-ink">{c.midterm}</span></span>;
  return (
    <span className="text-ink-3" title="Chưa có điểm">
      -
    </span>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`font-mono leading-none font-semibold tracking-tight ${strong ? "text-4xl text-accent-strong" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

const fmt = (v: number | null, digits = 2) => (v === null ? "-" : v.toFixed(digits));

export async function GradesPanel({ className }: { className?: string }) {
  const { grades, recentGrades, hasAny } = await loadFtu();
  const semesters = grades?.semesters ?? [];
  const summary = semesters.find((s) => s.cumGpa4 !== null) ?? null;
  const shown: NormalizedSemester | null = semesters.find((s) => s.courses.some(hasScore)) ?? null;
  const past = semesters.filter((s) => s !== shown && s.gpa4 !== null);

  return (
    <Panel title="Điểm" icon={<GraduationCap />} className={className}>
      {!grades ? (
        hasAny ? <Empty>Chưa đọc được bảng điểm.</Empty> : <NoData />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4 rounded-xl bg-surface-2 p-4">
            <Stat label="GPA tích lũy (hệ 4)" value={fmt(summary?.cumGpa4 ?? null)} strong />
            <Stat label="Hệ 10" value={fmt(summary?.cumGpa10 ?? null)} />
            <Stat label="Tín chỉ tích lũy" value={summary?.cumCredits === null || !summary ? "-" : String(summary.cumCredits)} />
          </div>

          {shown && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{shown.name}</p>
              <ul className="space-y-1">
                {shown.courses.map((c) => {
                  const isNew = recentGrades.has(`${shown.code}|${c.code}`);
                  return (
                    <li key={c.code} className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-lg px-2 py-2 hover:bg-surface-2 sm:grid-cols-[1fr_3rem_auto_3rem]">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="break-words">{c.name}</span>
                          {isNew && <Pill tone="accent">Mới</Pill>}
                        </span>
                        <span className="text-xs text-ink-3">{c.code}</span>
                      </span>
                      <span className="hidden text-center font-mono text-xs text-ink-2 sm:block">{c.credits ?? "-"} TC</span>
                      <span className="text-right">
                        <ScoreCell c={c} />
                      </span>
                      <span className="hidden text-right sm:block">{c.letter ? <Pill tone={c.letter.startsWith("F") ? "danger" : "neutral"}>{c.letter}</Pill> : null}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {past.length > 0 && (
            <details className="group rounded-xl border border-line px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ink-2 hover:text-ink">Các học kỳ trước</summary>
              <ul className="mt-3 space-y-2">
                {past.map((s) => (
                  <li key={s.code} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{s.name}</span>
                    <span className="shrink-0 font-mono text-ink-2">
                      <span className="font-semibold text-ink">{fmt(s.gpa4)}</span> / {fmt(s.gpa10)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}

export async function NoticeList({ className }: { className?: string }) {
  const { notices, hasAny } = await loadFtu();
  return (
    <Panel
      title="Thông báo FTU"
      icon={<Megaphone />}
      className={className}
      action={
        <a href="https://ftugate.ftu.edu.vn/" target="_blank" rel="noreferrer" className="text-sm text-ink-2 hover:text-ink">
          Mở FTUgate
        </a>
      }
    >
      {!hasAny ? (
        <NoData />
      ) : notices.length === 0 ? (
        <Empty>Không có thông báo.</Empty>
      ) : (
        <ul className="space-y-3.5">
          {notices.map((n) => (
            <li key={n.id} className="space-y-0.5">
              <p className={`line-clamp-2 text-sm leading-5 ${n.unread ? "font-semibold" : "text-ink-2"}`}>{n.title}</p>
              <p className="flex items-center gap-2 text-xs text-ink-3">
                {n.date ? `${n.date.slice(8, 10)}/${n.date.slice(5, 7)}/${n.date.slice(0, 4)}` : null}
                {n.unread && <Pill tone="accent">Chưa đọc</Pill>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

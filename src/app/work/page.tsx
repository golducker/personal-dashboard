import Link from "next/link";
import { CaretLeft, CaretRight, ChartBar, ClockCountdown, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/app-header";
import { BTN, BTN_GHOST, Empty, INPUT, Panel, Pill } from "@/components/card";
import { TaskLine } from "@/components/deadline-sections";
import { GroupDoneButton } from "@/components/group-done-button";
import { loadDeadlines } from "@/lib/drive/queries";
import {
  applyFilters,
  buildTimeline,
  clampWeek,
  progressByAssignee,
  progressByProject,
  splitAssignees,
  windowStart,
  type Progress,
} from "@/lib/drive/view";
import { formatDayKey, dayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = { w?: string; assignee?: string; project?: string; status?: string };

const DAYS_PER_PAGE = 7;

function href(p: Params, over: Partial<Params>): string {
  const merged = { ...p, ...over };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v && v !== "0") q.set(k, v);
  const s = q.toString();
  return s ? `/work?${s}` : "/work";
}

/** `openIds` (project list only): open task ids per row name, for the "Xong hết" button. */
function ProgressList({ items, openIds }: { items: Progress[]; openIds?: Map<string, string[]> }) {
  if (items.length === 0) return <Empty>Chưa có dữ liệu.</Empty>;
  return (
    <ul className="space-y-3">
      {items.slice(0, 12).map((p) => (
        <li key={p.name}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{p.name}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {openIds && <GroupDoneButton label={p.name} ids={openIds.get(p.name) ?? []} />}
              <span className="font-mono text-xs text-ink-2 tabular-nums">
                {p.done}/{p.total} · {p.percent}%
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label={p.name}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${p.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function WorkPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const week = clampWeek(params.w);
  const today = dayKey(new Date());
  const start = windowStart(today, week);

  const all = await loadDeadlines("work");
  const assignees = [...new Set(all.flatMap((r) => splitAssignees(r.assignee)))].sort((a, b) => a.localeCompare(b, "vi"));
  const projects = [...new Set(all.map((r) => r.groupLabel).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "vi"));
  const statuses = [...new Set(all.map((r) => r.status).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "vi"));

  const filtered = applyFilters(all, { assignee: params.assignee, project: params.project, status: params.status });
  const timeline = buildTimeline(filtered, start, DAYS_PER_PAGE, today);
  const last = timeline.days[timeline.days.length - 1].day;
  const filtersActive = !!(params.assignee || params.project || params.status);
  // same key as progressByProject, so each progress row finds its open tasks
  const openByProject = new Map<string, string[]>();
  for (const r of all) {
    if (r.done) continue;
    const k = r.groupLabel ?? "Không rõ dự án";
    openByProject.set(k, [...(openByProject.get(k) ?? []), r.id]);
  }

  return (
    <div className="page-pad mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
      <AppHeader title="Công việc" subtitle="Timeline task của cả team từ Drive." />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <form method="get" action="/work" className="card flex flex-wrap items-end gap-3 p-4">
            {[
              { name: "assignee", label: "Người phụ trách", value: params.assignee, options: assignees.map((a) => [a, a] as const) },
              { name: "project", label: "Dự án", value: params.project, options: projects.map((a) => [a, a] as const) },
              {
                name: "status",
                label: "Trạng thái",
                value: params.status,
                options: [["open", "Chưa xong"], ["done", "Đã xong"], ["p:todo", "Chưa làm"], ["p:ongoing", "Đang làm"], ["p:postponed", "Hoãn"], ...statuses.map((s) => [s, s] as const)],
              },
            ].map((f) => (
              <label key={f.name} className="min-w-36 flex-1 space-y-1 text-xs font-medium text-ink-2">
                {f.label}
                <select name={f.name} defaultValue={f.value ?? ""} className={INPUT}>
                  <option value="">Tất cả</option>
                  {f.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <input type="hidden" name="w" value={week} />
            <button type="submit" className={BTN}>
              Lọc
            </button>
            {filtersActive && (
              <Link href={href({ w: params.w }, {})} className={BTN_GHOST}>
                Bỏ lọc
              </Link>
            )}
          </form>

          {timeline.overdue.length > 0 && (
            <Panel title="Quá hạn chưa xong" icon={<ClockCountdown />} meta={`${timeline.overdue.length} việc`}>
              <ul className="space-y-2.5">
                {timeline.overdue.map((r) => (
                  <TaskLine key={r.id} r={r} today={today} />
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Timeline"
            icon={<ListChecks />}
            meta={`${formatDayKey(start)} – ${formatDayKey(last)}`}
            action={
              <div className="flex items-center gap-1">
                <Link href={href(params, { w: String(week - 1) })} aria-label="Tuần trước" aria-disabled={week <= -8} className={BTN_GHOST}>
                  <CaretLeft />
                </Link>
                {week !== 0 && (
                  <Link href={href(params, { w: "0" })} className={BTN_GHOST}>
                    Hôm nay
                  </Link>
                )}
                <Link href={href(params, { w: String(week + 1) })} aria-label="Tuần sau" aria-disabled={week >= 2} className={BTN_GHOST}>
                  <CaretRight />
                </Link>
              </div>
            }
          >
            {all.length === 0 ? (
              <Empty>
                Chưa có task công việc.{" "}
                <Link href="/settings" className="font-medium text-accent-strong underline-offset-2 hover:underline">
                  Thêm nguồn Drive hồ sơ Công việc
                </Link>
              </Empty>
            ) : (
              <div className="space-y-3">
                {timeline.days.map((d) => (
                  <section key={d.day} className={`rounded-2xl p-4 ${d.isToday ? "bg-accent-soft" : "bg-surface-2"}`}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm">
                      <span className={`font-semibold ${d.isToday ? "text-accent-deep" : ""}`}>{d.isToday ? "Hôm nay" : formatDayKey(d.day)}</span>
                      {d.isToday && <span className="text-ink-3">{formatDayKey(d.day)}</span>}
                      {d.tasks.length > 0 && <Pill>{d.tasks.length}</Pill>}
                    </h3>
                    {d.tasks.length === 0 ? (
                      <p className="text-sm text-ink-2">Không có việc.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {d.tasks.map((r) => (
                          <TaskLine key={r.id} r={r} today={today} />
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Panel title="Tiến độ theo dự án" icon={<ChartBar />}>
            <ProgressList items={progressByProject(all)} openIds={openByProject} />
          </Panel>
          <Panel title="Tiến độ theo người" icon={<ChartBar />}>
            <ProgressList items={progressByAssignee(all)} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

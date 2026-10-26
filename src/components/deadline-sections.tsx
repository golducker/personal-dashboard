import Link from "next/link";
import { CalendarCheck, FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { fileUrl } from "@/lib/drive/client";
import { PROFILE_LABELS } from "@/lib/drive/sources";
import { loadRecentFiles } from "@/lib/drive/queries";
import { getDeadlines } from "@/lib/home-data";
import { groupByEvent, isOverdue, type DeadlineRow } from "@/lib/drive/view";
import { relativeTimeVi } from "@/lib/relative-time";
import { dayKey, timeLabel } from "@/lib/time";
import { Empty, Panel, Pill } from "./card";
import { DeadlineProgress } from "./deadline-progress";
import { GroupDoneButton } from "./group-done-button";
import { RecentFilesList, type RecentFileTab } from "./recent-files-list";

const MAX_PER_GROUP = 8;
const sheetUrl = (fileId: string) => fileUrl(fileId, "application/vnd.google-apps.spreadsheet");

/** "26/10" or "26/10 14:30" (the 23:59 default is shown as a date only). */
export function dueLabel(d: Date | null): string {
  if (!d) return "Chưa có hạn";
  const day = dayKey(d);
  const t = timeLabel(d);
  return `${day.slice(8)}/${day.slice(5, 7)}${t === "23:59" ? "" : " " + t}`;
}

export function TaskLine({ r, today, showAssignee = true }: { r: DeadlineRow; today: string; showAssignee?: boolean }) {
  const overdue = isOverdue(r, today);
  return (
    <li className="flex items-start gap-3">
      <DeadlineProgress id={r.id} title={r.title} progress={r.progress} sheetDone={r.sheetDone} />
      <span className={`w-14 shrink-0 pt-0.5 font-mono text-xs leading-5 ${overdue ? "font-semibold text-danger" : "text-ink-2"}`}>
        {r.dueAt ? dueLabel(r.dueAt) : "--"}
      </span>
      <span className="min-w-0 flex-1">
        <a
          href={r.link ?? sheetUrl(r.fileId)}
          target="_blank"
          rel="noreferrer"
          className={`text-sm leading-5 font-medium break-words hover:underline ${r.done ? "text-ink-3 line-through" : ""}`}
        >
          {r.title}
        </a>
        {((showAssignee && r.assignee) || (!r.done && r.status)) && (
          <span className="block text-xs text-ink-2">
            {[showAssignee ? r.assignee : null, r.done ? null : r.status].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {r.done ? (
        <Pill tone="accent">Xong</Pill>
      ) : r.progress === "postponed" ? (
        <Pill tone="warn">Hoãn</Pill>
      ) : overdue ? (
        <Pill tone="danger">Quá hạn</Pill>
      ) : r.progress === "ongoing" ? (
        <Pill tone="accent">Đang làm</Pill>
      ) : null}
    </li>
  );
}

export async function DeadlinePanel({ className, showDone }: { className?: string; showDone: boolean }) {
  const today = dayKey(new Date());
  const all = await getDeadlines();
  const mlsv = all.filter((r) => r.profile === "mlsv");
  const work = all.filter((r) => r.profile === "work" && !r.done && r.dueAt && dayKey(r.dueAt) <= today);
  const { groups, undated } = groupByEvent(mlsv, showDone);
  const hiddenDone = mlsv.filter((r) => r.done).length;
  const openCount = mlsv.filter((r) => !r.done).length;
  const overdueWork = work.filter((r) => dayKey(r.dueAt!) < today);
  const todayWork = work.filter((r) => dayKey(r.dueAt!) === today);

  const toggle =
    hiddenDone > 0 ? (
      <Link href={showDone ? "/" : "/?done=1"} className="text-xs font-medium text-accent-strong hover:underline">
        {showDone ? "Ẩn việc đã xong" : `Hiện ${hiddenDone} việc đã xong`}
      </Link>
    ) : undefined;

  return (
    <Panel
      title="Deadline"
      icon={<CalendarCheck />}
      meta={openCount ? `${openCount} việc MLSV` : undefined}
      action={toggle}
      className={className}
    >
      {all.length === 0 ? (
        <Empty>
          Chưa có deadline từ Drive.{" "}
          <Link href="/settings" className="font-medium text-accent-strong underline-offset-2 hover:underline">
            Thêm nguồn Drive
          </Link>
        </Empty>
      ) : (
        <div className="space-y-5">
          {work.length > 0 && (
            <div className="rounded-xl border border-line p-3.5">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Công việc</span>
                {overdueWork.length > 0 && <Pill tone="danger">{overdueWork.length} quá hạn</Pill>}
                {todayWork.length > 0 && <Pill tone="warn">{todayWork.length} hôm nay</Pill>}
                <span className="ml-auto">
                  <GroupDoneButton label="Công việc" ids={work.map((r) => r.id)} />
                </span>
                <Link href="/work" className="text-xs font-medium text-accent-strong hover:underline">
                  Xem tất cả
                </Link>
              </p>
              <ul className="space-y-2">
                {[...overdueWork, ...todayWork].slice(0, 5).map((r) => (
                  <TaskLine key={r.id} r={r} today={today} />
                ))}
              </ul>
            </div>
          )}

          {groups.length === 0 && undated.length === 0 && work.length === 0 && <Empty>Không có deadline MLSV nào đang mở.</Empty>}

          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                  {g.label}
                  {g.date && <span className="text-xs font-normal text-ink-3">diễn ra {dueLabel(g.date).slice(0, 5)}</span>}
                  <Pill>{PROFILE_LABELS.mlsv}</Pill>
                </h3>
                <span className="ml-auto">
                  <GroupDoneButton label={g.label} ids={g.tasks.filter((r) => !r.done).map((r) => r.id)} />
                </span>
              </div>
              <ul className="space-y-2.5">
                {g.tasks.slice(0, MAX_PER_GROUP).map((r) => (
                  <TaskLine key={r.id} r={r} today={today} />
                ))}
              </ul>
              {g.tasks.length > MAX_PER_GROUP && (
                <p className="mt-2 text-xs text-ink-3">và {g.tasks.length - MAX_PER_GROUP} việc nữa</p>
              )}
            </section>
          ))}

          {undated.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-2">Chưa có hạn</h3>
              <ul className="space-y-2.5">
                {undated.slice(0, MAX_PER_GROUP).map((r) => (
                  <TaskLine key={r.id} r={r} today={today} />
                ))}
              </ul>
              {undated.length > MAX_PER_GROUP && (
                <p className="mt-2 text-xs text-ink-3">và {undated.length - MAX_PER_GROUP} việc nữa</p>
              )}
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}

const PROFILE_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "work", label: PROFILE_LABELS.work },
  { key: "mlsv", label: PROFILE_LABELS.mlsv },
  { key: "study", label: PROFILE_LABELS.study },
  { key: "brain", label: PROFILE_LABELS.brain },
] as const;

export async function RecentFilesPanel({ className }: { className?: string }) {
  // Load every tab at once so switching profile is instant and never reloads the page.
  const tabs: RecentFileTab[] = await Promise.all(
    PROFILE_FILTERS.map(async (f) => {
      const rows = await loadRecentFiles(f.key || undefined, 10);
      return {
        key: f.key,
        label: f.label,
        files: rows.map((r) => ({
          id: r.id,
          name: r.name,
          path: r.path,
          url: fileUrl(r.id, r.mimeType),
          profileLabel: PROFILE_LABELS[r.profile],
          ago: r.modifiedTime ? relativeTimeVi(r.modifiedTime) : null,
        })),
      };
    }),
  );

  return (
    <Panel title="Drive gần đây" icon={<FolderOpen />} className={className}>
      <RecentFilesList tabs={tabs} />
    </Panel>
  );
}

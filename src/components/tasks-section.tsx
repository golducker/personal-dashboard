import { CheckSquareOffset } from "@phosphor-icons/react/dist/ssr";
import { dayKey, timeLabel } from "@/lib/time";
import { getTodayAndOverdue, getUpcoming, listProjects, splitByDue, TODOIST_UNAVAILABLE_MESSAGE } from "@/lib/todoist";
import { applyOverlay, flushOutbox, listOutbox, loadCache, saveCache, takeFailed } from "@/lib/todoist-offline";
import { load, toTaskView } from "@/lib/today";
import { Panel, SourceProblem } from "./card";
import { QuickAddTask } from "./quick-add-task";
import { TaskList } from "./task-list";

export async function TasksSection({ className }: { className?: string }) {
  const today = dayKey(new Date());
  await flushOutbox().catch(() => {});
  const result = await load(async () => {
    const [now, upcoming, projects] = await Promise.all([
      getTodayAndOverdue(),
      getUpcoming(7),
      listProjects().catch(() => []),
    ]);
    return { now, upcoming, projects };
  });
  const unavailable = !result.ok && result.message === TODOIST_UNAVAILABLE_MESSAGE;

  let data = result.ok ? result.data : null;
  let notice: string | null = null;
  let pendingIds = new Set<string>();
  const pendingRows = await listOutbox().catch(() => []);

  if (result.ok) {
    await saveCache(result.data);
    if (pendingRows.length) pendingIds = new Set(pendingRows.map((r) => r.taskId));
    const failed = await takeFailed();
    if (failed.length) notice = `${failed.length} thay đổi không đồng bộ được với Todoist (vd: ${failed[failed.length - 1].content ?? "việc đã bị xoá"}).`;
  } else if (unavailable) {
    const cache = await loadCache();
    if (cache || pendingRows.length) {
      const base = cache ?? { now: [], upcoming: [], projects: [], at: "" };
      const overlay = applyOverlay(base, pendingRows);
      pendingIds = overlay.pendingIds;
      data = { now: overlay.tasks, upcoming: overlay.tasks, projects: base.projects };
      const sync = pendingRows.length ? `${pendingRows.length} thay đổi sẽ tự đồng bộ khi Todoist hoạt động lại.` : "";
      notice = ["Todoist đang bảo trì.", base.at ? `Đang hiện bản lưu lúc ${timeLabel(base.at)}.` : "", sync].filter(Boolean).join(" ");
    }
  }

  if (!data) {
    return (
      <Panel title="Việc cần làm" icon={<CheckSquareOffset />} className={className}>
        <div className="space-y-4">
          <SourceProblem failure={result as Extract<typeof result, { ok: false }>} name="Todoist" />
          {unavailable && <QuickAddTask />}
        </div>
      </Panel>
    );
  }

  const names = new Map(data.projects.map((p) => [p.id, p.name]));
  const split = splitByDue(data.now);
  const later = splitByDue(data.upcoming).later;
  const view = (list: typeof data.now) => list.map((t) => ({ ...toTaskView(t, names, today), ...(pendingIds.has(t.id) ? { pending: true } : {}) }));
  const count = split.overdue.length + split.today.length;

  return (
    <Panel title="Việc cần làm" icon={<CheckSquareOffset />} meta={count ? `${count} việc` : undefined} className={className}>
      <div className="space-y-4">
        {notice && <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{notice}</p>}
        <QuickAddTask />
        <TaskList overdue={view(split.overdue)} today={view(split.today)} later={view(later)} />
      </div>
    </Panel>
  );
}

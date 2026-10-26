import { CheckSquareOffset } from "@phosphor-icons/react/dist/ssr";
import { dayKey } from "@/lib/time";
import { getTodayAndOverdue, getUpcoming, listProjects, splitByDue } from "@/lib/todoist";
import { load, toTaskView } from "@/lib/today";
import { Panel, SourceProblem } from "./card";
import { QuickAddTask } from "./quick-add-task";
import { TaskList } from "./task-list";

export async function TasksSection({ className }: { className?: string }) {
  const today = dayKey(new Date());
  const result = await load(async () => {
    const [now, upcoming, projects] = await Promise.all([
      getTodayAndOverdue(),
      getUpcoming(7),
      listProjects().catch(() => []),
    ]);
    return { now, upcoming, projects };
  });

  if (!result.ok) {
    return (
      <Panel title="Việc cần làm" icon={<CheckSquareOffset />} className={className}>
        <SourceProblem failure={result} name="Todoist" />
      </Panel>
    );
  }

  const { now, upcoming, projects } = result.data;
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const split = splitByDue(now);
  const later = splitByDue(upcoming).later;
  const view = (list: typeof now) => list.map((t) => toTaskView(t, names, today));
  const count = split.overdue.length + split.today.length;

  return (
    <Panel title="Việc cần làm" icon={<CheckSquareOffset />} meta={count ? `${count} việc` : undefined} className={className}>
      <div className="space-y-4">
        <QuickAddTask />
        <TaskList overdue={view(split.overdue)} today={view(split.today)} later={view(later)} />
      </div>
    </Panel>
  );
}

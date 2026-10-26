import { dayKey } from "@/lib/time";
import { getTodayAndOverdue, getUpcoming, listProjects, splitByDue } from "@/lib/todoist";
import { load, toTaskView } from "@/lib/today";
import { CARD, SectionTitle, SourceProblem } from "./card";
import { QuickAddTask } from "./quick-add-task";
import { TaskList } from "./task-list";

export async function TasksSection() {
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
      <section className="space-y-3">
        <SectionTitle>Việc cần làm</SectionTitle>
        <SourceProblem failure={result} name="Todoist" />
      </section>
    );
  }

  const { now, upcoming, projects } = result.data;
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const split = splitByDue(now);
  const later = splitByDue(upcoming).later;
  const view = (list: typeof now) => list.map((t) => toTaskView(t, names, today));

  return (
    <section className="space-y-3">
      <SectionTitle>Việc cần làm</SectionTitle>
      <div className={`${CARD} space-y-3 p-4`}>
        <QuickAddTask />
        <TaskList overdue={view(split.overdue)} today={view(split.today)} later={view(later)} />
      </div>
    </section>
  );
}

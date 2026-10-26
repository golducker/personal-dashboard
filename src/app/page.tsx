import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { CalendarSection } from "@/components/calendar-section";
import { DeadlinePanel, RecentFilesPanel } from "@/components/deadline-sections";
import { PanelSkeleton } from "@/components/card";
import { ExamList, GradesPanel, NoticeList, WeekSchedule } from "@/components/ftu-sections";
import { TasksSection } from "@/components/tasks-section";
import { formatLongDate, timeLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

// Desktop: today's calendar + tasks first, then the FTU week and exams, then grades and notices.
// Mobile keeps DOM order, which puts exams before the week schedule.
const LAYOUT = {
  calendar: "lg:col-span-7",
  tasks: "lg:col-span-5",
  exams: "lg:col-span-4 lg:col-start-9 lg:row-start-2",
  week: "lg:col-span-8 lg:col-start-1 lg:row-start-2",
  grades: "lg:col-span-8",
  notices: "lg:col-span-4",
  deadlines: "lg:col-span-7",
  drive: "lg:col-span-5",
};

function greeting(now: Date): string {
  const hour = Number(timeLabel(now).slice(0, 2));
  if (hour < 11) return "Chào buổi sáng, gng.";
  if (hour < 14) return "Chào buổi trưa, gng.";
  if (hour < 18) return "Chào buổi chiều, gng.";
  return "Chào buổi tối, gng.";
}

export default async function Home({ searchParams }: { searchParams: Promise<{ done?: string; drive?: string }> }) {
  const { done, drive } = await searchParams;
  const now = new Date();
  // "Thứ Hai, 26 tháng 10, 2026" → title without the year
  const title = formatLongDate(now).split(", ").slice(0, 2).join(", ");
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6">
      <AppHeader title={title} subtitle={greeting(now)} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <Suspense fallback={<PanelSkeleton title="Lịch hôm nay" className={LAYOUT.calendar} />}>
          <CalendarSection className={LAYOUT.calendar} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Việc cần làm" className={LAYOUT.tasks} />}>
          <TasksSection className={LAYOUT.tasks} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Lịch thi" rows={2} className={LAYOUT.exams} />}>
          <ExamList className={LAYOUT.exams} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Thời khóa biểu tuần này" rows={4} className={LAYOUT.week} />}>
          <WeekSchedule className={LAYOUT.week} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Điểm" rows={4} className={LAYOUT.grades} />}>
          <GradesPanel className={LAYOUT.grades} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Thông báo FTU" className={LAYOUT.notices} />}>
          <NoticeList className={LAYOUT.notices} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Deadline" className={LAYOUT.deadlines} />}>
          <DeadlinePanel className={LAYOUT.deadlines} showDone={done === "1"} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Drive gần đây" className={LAYOUT.drive} />}>
          <RecentFilesPanel className={LAYOUT.drive} profile={drive} />
        </Suspense>
      </div>
    </div>
  );
}

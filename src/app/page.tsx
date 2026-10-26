import { Suspense } from "react";
import { CalendarSection } from "@/components/calendar-section";
import { DeadlinePanel, RecentFilesPanel } from "@/components/deadline-sections";
import { PanelSkeleton } from "@/components/card";
import { ExamList, GradesPanel, NoticeList, WeekSchedule } from "@/components/ftu-sections";
import { HeroView, HomeHero } from "@/components/home-hero";
import { TasksSection } from "@/components/tasks-section";

export const dynamic = "force-dynamic";

// Zig-zag 12-column rhythm on desktop: 7|5, 8|4, 7|5, 5|7. Mobile keeps DOM order (exams before the week schedule).
const LAYOUT = {
  calendar: "lg:col-span-7",
  tasks: "lg:col-span-5",
  deadlines: "lg:col-span-8",
  exams: "lg:col-span-4",
  week: "lg:col-span-7",
  notices: "lg:col-span-5",
  grades: "lg:col-span-5",
  drive: "lg:col-span-7",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  return (
    <div className="page-pad mx-auto w-full max-w-7xl flex-1 px-4 pt-3 sm:px-6">
      <Suspense fallback={<HeroView stats={null} />}>
        <HomeHero />
      </Suspense>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <Suspense fallback={<PanelSkeleton title="Lịch hôm nay" className={LAYOUT.calendar} />}>
          <CalendarSection className={LAYOUT.calendar} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Việc cần làm" className={LAYOUT.tasks} />}>
          <TasksSection className={LAYOUT.tasks} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Deadline" rows={4} className={LAYOUT.deadlines} />}>
          <DeadlinePanel className={LAYOUT.deadlines} showDone={done === "1"} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Lịch thi" rows={2} className={LAYOUT.exams} />}>
          <ExamList className={LAYOUT.exams} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Thời khóa biểu tuần này" rows={4} className={LAYOUT.week} />}>
          <WeekSchedule className={LAYOUT.week} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Thông báo FTU" className={LAYOUT.notices} />}>
          <NoticeList className={LAYOUT.notices} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Điểm" rows={4} className={LAYOUT.grades} />}>
          <GradesPanel className={LAYOUT.grades} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Drive gần đây" className={LAYOUT.drive} />}>
          <RecentFilesPanel className={LAYOUT.drive} />
        </Suspense>
      </div>
    </div>
  );
}

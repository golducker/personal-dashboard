import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { CalendarSection } from "@/components/calendar-section";
import { CARD } from "@/components/card";
import { TasksSection } from "@/components/tasks-section";

export const dynamic = "force-dynamic";

function Loading({ label }: { label: string }) {
  return <div className={`${CARD} p-4 text-sm text-neutral-500`}>Đang tải {label}…</div>;
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
      <AppHeader title="Hôm nay" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Suspense fallback={<Loading label="lịch" />}>
          <CalendarSection />
        </Suspense>
        <Suspense fallback={<Loading label="việc cần làm" />}>
          <TasksSection />
        </Suspense>
      </div>
    </div>
  );
}

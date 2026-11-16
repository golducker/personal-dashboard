import { AppHeader } from "@/components/app-header";
import { DailySection } from "@/components/daily-section";

export const dynamic = "force-dynamic";

export default function DailyPage() {
  return (
    <div className="page-pad mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6">
      <AppHeader title="Hằng ngày" subtitle="Danh sách tự làm mới mỗi ngày. Tick để lên cấp." />
      <DailySection />
    </div>
  );
}

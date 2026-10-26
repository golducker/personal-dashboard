import { AppHeader } from "@/components/app-header";
import { CARD, SectionTitle } from "@/components/card";
import { getSourceHealth, type HealthStatus } from "@/lib/health";
import { relativeTimeVi } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

const NEUTRAL = "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
const BADGE: Record<HealthStatus, { text: string; cls: string }> = {
  not_configured: { text: "Chưa cấu hình", cls: NEUTRAL },
  not_connected: { text: "Chưa kết nối", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  never_synced: { text: "Chưa đồng bộ", cls: NEUTRAL },
  ok: { text: "OK", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  error: { text: "Lỗi", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  running: { text: "Đang chạy", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
};

export default async function HealthPage() {
  const sources = await getSourceHealth();
  const now = new Date();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
      <AppHeader title="Tình trạng" subtitle="Nguồn dữ liệu và lần đồng bộ gần nhất" />
      <section className="space-y-4">
        <SectionTitle>Tình trạng nguồn dữ liệu</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => {
            const badge = BADGE[s.status];
            return (
              <article key={s.source} className={`${CARD} space-y-2 p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{s.label}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
                <p className="text-sm text-neutral-500">
                  Đồng bộ thành công gần nhất: {s.lastSuccessAt ? relativeTimeVi(s.lastSuccessAt, now) : "chưa có"}
                </p>
                {s.lastError && (
                  <p className="break-words rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    {s.lastError}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

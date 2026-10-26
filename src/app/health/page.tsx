import { Pulse } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/app-header";
import { Panel, Pill } from "@/components/card";
import { getSourceHealth, type HealthStatus } from "@/lib/health";
import { relativeTimeVi } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

const BADGE: Record<HealthStatus, { text: string; tone: "neutral" | "accent" | "danger" | "warn" }> = {
  not_configured: { text: "Chưa cấu hình", tone: "neutral" },
  not_connected: { text: "Chưa kết nối", tone: "warn" },
  never_synced: { text: "Chưa đồng bộ", tone: "neutral" },
  ok: { text: "Ổn", tone: "accent" },
  error: { text: "Lỗi", tone: "danger" },
  running: { text: "Đang chạy", tone: "warn" },
};

export default async function HealthPage() {
  const sources = await getSourceHealth();
  const now = new Date();
  const problems = sources.filter((s) => s.status === "error" || s.status === "not_connected").length;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
      <AppHeader title="Tình trạng" subtitle="Nguồn dữ liệu và lần đồng bộ gần nhất." />
      <Panel title="Nguồn dữ liệu" icon={<Pulse />} meta={problems ? `${problems} cần xử lý` : "Mọi thứ ổn"}>
        <ul className="-mx-2 space-y-1">
          {sources.map((s) => {
            const badge = BADGE[s.status];
            return (
              <li key={s.source} className="rounded-xl px-2 py-3 hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-ink-2">
                      Thành công gần nhất: {s.lastSuccessAt ? relativeTimeVi(s.lastSuccessAt, now) : "chưa có"}
                    </p>
                  </div>
                  <Pill tone={badge.tone}>{badge.text}</Pill>
                </div>
                {s.lastError && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs break-words text-danger">{s.lastError}</p>}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

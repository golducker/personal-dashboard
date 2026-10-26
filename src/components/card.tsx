import Link from "next/link";
import type { ReactNode } from "react";
import type { Loaded } from "@/lib/today";

// Shape rule: panels rounded-2xl, controls/inputs rounded-lg, pills rounded-full.
export const CARD = "rounded-2xl border border-line bg-surface shadow-panel";
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const BTN = `${BTN_BASE} border border-line-strong text-ink hover:bg-surface-2`;
export const BTN_PRIMARY = `${BTN_BASE} bg-accent text-accent-ink hover:opacity-90`;
export const BTN_GHOST = `${BTN_BASE} text-ink-2 hover:bg-surface-2 hover:text-ink`;
export const BTN_DANGER = `${BTN_BASE} bg-danger text-surface hover:opacity-90`;
export const INPUT =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function Panel({
  title,
  icon,
  meta,
  action,
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col ${className}`}>
      <header className="flex items-start gap-2.5 px-5 pt-4 pb-3">
        {icon && <span className="mt-0.5 text-ink-3 [&>svg]:size-[18px]">{icon}</span>}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {meta && <span className="text-sm text-ink-3">{meta}</span>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "danger" | "warn"; children: ReactNode }) {
  const cls = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">{children}</p>;
}

/** Placeholder with the rough shape of a panel while its data loads. */
export function PanelSkeleton({ title, rows = 3, className = "" }: { title: string; rows?: number; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <div className="space-y-3" aria-busy="true" aria-label={`Đang tải ${title.toLowerCase()}`}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-12 rounded-lg bg-surface-2 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/5 rounded bg-surface-2 motion-safe:animate-pulse" />
              <div className="h-3 w-2/5 rounded bg-surface-2 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Body shown inside a panel when its source is missing, expired or failing. */
export function SourceProblem({
  failure,
  name,
}: {
  failure: Extract<Loaded<unknown>, { ok: false }>;
  name: "Google" | "Todoist";
}) {
  const connect = failure.kind === "not_connected" || failure.kind === "expired";
  const title =
    failure.kind === "not_connected"
      ? `Chưa kết nối ${name}`
      : failure.kind === "expired"
        ? `Phiên ${name} đã hết hạn`
        : failure.kind === "not_configured"
          ? `Chưa cấu hình ${name}`
          : `Không tải được dữ liệu ${name}`;
  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
      <p className="font-medium">{title}</p>
      {failure.kind === "error" && <p className="break-words text-danger">{failure.message}</p>}
      {failure.kind === "not_configured" && <p className="text-ink-2">Thêm TODOIST_API_TOKEN vào biến môi trường.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {connect && (
          <a href="/api/auth/google/start" className={BTN_PRIMARY}>
            {failure.kind === "expired" ? "Kết nối lại Google" : "Kết nối Google"}
          </a>
        )}
        <Link href="/settings" className={BTN_GHOST}>
          Mở cài đặt
        </Link>
      </div>
    </div>
  );
}

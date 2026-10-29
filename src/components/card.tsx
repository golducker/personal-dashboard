import Link from "next/link";
import type { ReactNode } from "react";
import type { Loaded } from "@/lib/today";
import { MascotStatic } from "./mascot";

// Shape rule: panels 16px (.card in globals.css), controls rounded-xl, tags rounded-md.
// .card is a flat solid surface with a hairline border in both worlds; .btn gets a 1px press.
export const CARD = "card";
const BTN_BASE =
  "btn inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 md:min-h-9 md:px-3.5 md:py-1.5";
export const BTN = `${BTN_BASE} border border-line-strong text-ink hover:bg-surface-2`;
export const BTN_PRIMARY = `${BTN_BASE} btn-primary bg-accent text-accent-ink`;
export const BTN_GHOST = `${BTN_BASE} text-ink-2 hover:bg-surface-2 hover:text-ink`;
export const BTN_DANGER = `${BTN_BASE} bg-danger text-surface`;
export const INPUT =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink outline-none transition placeholder:text-ink-3 focus:border-accent-strong focus:ring-2 focus:ring-accent-soft md:py-2 md:text-sm";

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
      <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        {icon && <span className="shrink-0 text-ink-3 [&>svg]:size-4">{icon}</span>}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.01em]">{title}</h2>
          {meta && <span className="tabular text-[13px] text-ink-3">{meta}</span>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      <div className="flex-1 px-5 pt-4 pb-5">{children}</div>
    </section>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "danger" | "warn"; children: ReactNode }) {
  const cls = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent-deep",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-xs font-medium ${cls}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-ink-2">
      <MascotStatic size="sm" className="shrink-0 opacity-80" />
      <p className="min-w-0 flex-1 text-pretty">{children}</p>
    </div>
  );
}

/** Placeholder with the rough shape of a panel while its data loads. */
export function PanelSkeleton({ title, rows = 3, className = "" }: { title: string; rows?: number; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <div className="space-y-3" aria-busy="true" aria-label={`Đang tải ${title.toLowerCase()}`}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-9 w-12 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-3/5 rounded" />
              <div className="skeleton h-3 w-2/5 rounded" />
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
  const maintenance = failure.kind === "error" && /maintenance|bảo trì|503/i.test(failure.message);
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
    <div className="space-y-3 text-sm">
      <p className="font-medium">{title}</p>
      {failure.kind === "error" && (
        // Raw API errors can be long JSON; show a readable line and keep the detail in the tooltip.
        <p className="line-clamp-2 break-words text-danger" title={failure.message}>
          {maintenance
            ? `${name} đang bảo trì, thử lại sau.`
            : /401|unauthori[sz]ed/i.test(failure.message)
              ? "Token không hợp lệ hoặc đã bị thu hồi."
              : failure.message}
        </p>
      )}
      {failure.kind === "not_configured" && <p className="text-ink-2">Thêm TODOIST_API_TOKEN vào biến môi trường.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {connect && (
          <a href="/api/auth/google/start" className={BTN_PRIMARY}>
            {failure.kind === "expired" ? "Kết nối lại Google" : "Kết nối Google"}
          </a>
        )}
        {!maintenance && (
          <Link href="/settings" className={BTN_GHOST}>
            Mở cài đặt
          </Link>
        )}
      </div>
    </div>
  );
}

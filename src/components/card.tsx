import Link from "next/link";
import type { ReactNode } from "react";
import type { Loaded } from "@/lib/today";

export const CARD = "rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900";
export const BTN =
  "rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10";
export const BTN_PRIMARY =
  "rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
export const INPUT =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{children}</h2>;
}

/** Inline card shown when a section's source is missing, expired or failing. */
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
    <div className={`${CARD} space-y-2 p-4 text-sm`}>
      <p className="font-medium">{title}</p>
      {failure.kind === "error" && (
        <p className="break-words rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {failure.message}
        </p>
      )}
      {failure.kind === "not_configured" && <p className="text-neutral-500">Thêm TODOIST_API_TOKEN vào biến môi trường.</p>}
      {connect && (
        <a href="/api/auth/google/start" className={`${BTN_PRIMARY} inline-block`}>
          {failure.kind === "expired" ? "Kết nối lại Google" : "Kết nối Google"}
        </a>
      )}
      <p>
        <Link href="/settings" className="text-neutral-500 underline">
          Mở cài đặt
        </Link>
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import { formatLongDate } from "@/lib/time";

/** Page title block. The persistent nav/header lives in AppChrome (root layout). */
export function AppHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="space-y-1.5 pt-3 pb-6 md:pb-8">
      <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-tight text-balance first-letter:uppercase md:text-[40px]">
        {title}
      </h1>
      <p className="text-sm text-ink-2 md:text-base">
        {subtitle ?? <span className="first-letter:uppercase">{formatLongDate()}</span>}
      </p>
    </header>
  );
}

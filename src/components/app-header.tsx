import type { ReactNode } from "react";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { formatLongDate } from "@/lib/time";
import { LogoutButton } from "./logout-button";
import { NavLinks } from "./nav-links";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-7 space-y-7">
      <div className="flex h-14 items-center gap-3">
        <span className="hidden items-center gap-2 font-semibold tracking-tight sm:flex">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
            <SquaresFour size={16} weight="bold" />
          </span>
          Dashboard
        </span>
        <NavLinks />
        <LogoutButton />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase sm:text-3xl">{title}</h1>
        <p className="text-sm text-ink-2">{subtitle ?? <span className="first-letter:uppercase">{formatLongDate()}</span>}</p>
      </div>
    </header>
  );
}

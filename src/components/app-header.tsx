import { formatLongDate } from "@/lib/time";
import { LogoutButton } from "./logout-button";
import { NavLinks } from "./nav-links";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <NavLinks />
        <LogoutButton />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm capitalize text-neutral-500">{subtitle ?? formatLongDate()}</p>
      </div>
    </header>
  );
}

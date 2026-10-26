"use client";

import { Moon, Sun, SunHorizon } from "@phosphor-icons/react";
import { useRef, useSyncExternalStore } from "react";
import { NEXT_THEME, THEME_LABELS, getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from "@/lib/theme";

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getThemeMode, () => "system");
}

/** Cycles Tự động -> Sáng -> Tối. The icon is chosen by CSS from <html data-theme>, so it never flashes. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const mode = useThemeMode();
  const ref = useRef<HTMLButtonElement>(null);
  const next = NEXT_THEME[mode];
  return (
    <button
      ref={ref}
      type="button"
      data-sfx="none"
      onClick={() => setThemeMode(next, ref.current)}
      aria-label={`Giao diện: ${THEME_LABELS[mode]}. Bấm để chuyển sang ${THEME_LABELS[next]}`}
      title={`Giao diện: ${THEME_LABELS[mode]}`}
      className={`btn grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2/60 text-ink-2 hover:text-ink md:size-10 ${className}`}
    >
      <SunHorizon size={20} weight="bold" className="ti ti-system" />
      <Sun size={20} weight="bold" className="ti ti-light" />
      <Moon size={20} weight="bold" className="ti ti-dark" />
    </button>
  );
}

"use client";

import { Moon, Sun, SunHorizon } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";
import { THEME_LABELS, setThemeMode, type ThemeMode } from "@/lib/theme";
import { SoundToggle } from "./sound-toggle";
import { useThemeMode } from "./theme-toggle";

const OPTIONS: Array<{ mode: ThemeMode; hint: string; icon: ReactNode }> = [
  { mode: "system", hint: "Theo thiết bị", icon: <SunHorizon size={20} weight="bold" /> },
  { mode: "light", hint: "Psyduck", icon: <Sun size={20} weight="bold" /> },
  { mode: "dark", hint: "Gengar", icon: <Moon size={20} weight="bold" /> },
];

/** Settings -> Giao diện: theme segmented control + sound switch. */
export function AppearanceControls() {
  const mode = useThemeMode();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Giao diện" className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = mode === o.mode;
          return (
            <button
              key={o.mode}
              ref={(el) => {
                refs.current[o.mode] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              data-sfx="none"
              onClick={() => setThemeMode(o.mode, refs.current[o.mode])}
              className={`btn flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm ${
                active ? "border-accent bg-accent-soft font-semibold text-ink" : "border-line-strong text-ink-2 hover:bg-surface-2"
              }`}
            >
              <span className={active ? "text-accent-strong" : ""}>{o.icon}</span>
              <span>{THEME_LABELS[o.mode]}</span>
              <span className="text-[11px] font-normal text-ink-3">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <SoundToggle />
    </div>
  );
}

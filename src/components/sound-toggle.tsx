"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { isSfxEnabled, setSfxEnabled, subscribeSfx } from "@/lib/sfx";

/** Switch for the synthesised UI sounds ("Âm thanh"), stored in localStorage. */
export function SoundToggle() {
  const on = useSyncExternalStore(subscribeSfx, isSfxEnabled, () => true);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-sfx="none"
      onClick={() => setSfxEnabled(!on)}
      className="btn flex min-h-12 w-full items-center gap-3 rounded-xl border border-line-strong px-3.5 py-2 text-left text-sm hover:bg-surface-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
        {on ? <SpeakerHigh size={20} weight="bold" /> : <SpeakerSlash size={20} weight="bold" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Âm thanh</span>
        <span className="block text-xs text-ink-2">Tiếng bấm, hoàn thành và linh vật. Âm lượng nhỏ.</span>
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-accent" : "bg-line-strong"}`}
      >
        <span
          className="absolute top-1 left-1 size-5 rounded-full bg-surface shadow transition-transform duration-300 [transition-timing-function:var(--ease-spring)]"
          style={{ transform: on ? "translateX(20px)" : "none" }}
        />
      </span>
    </button>
  );
}

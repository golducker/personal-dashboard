"use client";

import { useEffect } from "react";
import { sfx, unlockAudio } from "@/lib/sfx";

const TAP_TARGETS = 'button, a[href], [role="menuitem"], summary';

/**
 * One set of delegated listeners for the whole app (mounted once in the root layout):
 *  - unlock Web Audio on the first pointerdown (iOS)
 *  - tap sound for buttons/links/menu items
 */
export function GlobalFx() {
  useEffect(() => {
    const onDown = () => unlockAudio();

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAP_TARGETS);
      if (!el) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      if (el.closest('[data-sfx="none"]')) return;
      sfx.tap();
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}

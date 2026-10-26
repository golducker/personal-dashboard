"use client";

import { useEffect } from "react";
import { sfx, unlockAudio } from "@/lib/sfx";

const TAP_TARGETS = 'button, a[href], [role="menuitem"], summary';

/**
 * One set of delegated listeners for the whole app (mounted once in the root layout):
 *  - unlock Web Audio on the first pointerdown (iOS)
 *  - tap sound for buttons/links/menu items
 *  - ripple at the pointer on `.btn`
 *  - spotlight border: sets --mx/--my on the `.card` under the mouse
 */
export function GlobalFx() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let card: HTMLElement | null = null;
    let px = 0;
    let py = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const c = (e.target as Element | null)?.closest<HTMLElement>(".card") ?? null;
      if (!c) return;
      card = c;
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${px - r.left}px`);
        card.style.setProperty("--my", `${py - r.top}px`);
      });
    };

    const onDown = (e: PointerEvent) => {
      unlockAudio();
      if (reduced.matches) return;
      const btn = (e.target as Element | null)?.closest<HTMLElement>(".btn");
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ripple";
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - r.left - size / 2}px`;
      dot.style.top = `${e.clientY - r.top - size / 2}px`;
      btn.appendChild(dot);
      const a = dot.animate(
        [
          { transform: "scale(0)", opacity: 0.25 },
          { transform: "scale(1)", opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      a.onfinish = () => dot.remove();
    };

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAP_TARGETS);
      if (!el) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      if (el.closest('[data-sfx="none"]')) return;
      sfx.tap();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("click", onClick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}

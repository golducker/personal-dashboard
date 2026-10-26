"use client";

import { useEffect, useRef } from "react";

/**
 * Number that counts up from 0 the first time it scrolls into view.
 * Server renders the final value (no layout jump, works without JS); the animation writes textContent directly,
 * so there is no React re-render per frame.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  className = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => n.toFixed(decimals);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0 || typeof IntersectionObserver === "undefined") {
      el.textContent = fmt(value);
      return;
    }
    let raf = 0;
    el.textContent = fmt(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(value * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = fmt(value);
    };
  }, [value, decimals, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value.toFixed(decimals)}
    </span>
  );
}

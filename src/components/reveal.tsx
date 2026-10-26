"use client";

import { useEffect, type ElementType, type ReactNode } from "react";

const STEP_MS = 60;
const MAX_STAGGER = 6;

/**
 * Staggered, once-only reveal for every `.reveal` element (panels, list rows).
 * State is kept in a data attribute (data-rv="in"), so React re-renders that rewrite className can't undo it.
 * Mounted once in the root layout; a MutationObserver picks up streamed/navigated content.
 */
export function RevealObserver() {
  useEffect(() => {
    const show = (el: Element) => el.setAttribute("data-rv", "in");
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const showAll = () => document.querySelectorAll(".reveal:not([data-rv])").forEach(show);
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        visible.forEach((e, i) => {
          const el = e.target as HTMLElement;
          el.style.transitionDelay = `${Math.min(i, MAX_STAGGER) * STEP_MS}ms`;
          show(el);
          io.unobserve(el);
          // drop the delay once played so hover transitions stay snappy
          setTimeout(() => (el.style.transitionDelay = ""), 900);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );

    const seen = new WeakSet<Element>();
    let pending = 0;
    const scan = () => {
      pending = 0;
      document.querySelectorAll(".reveal:not([data-rv])").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(scan);
    };
    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      if (pending) cancelAnimationFrame(pending);
    };
  }, []);

  return null;
}

/** Wrapper for ad-hoc reveals: <Reveal as="li">. Panels and the common rows already carry `.reveal`. */
export function Reveal({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`reveal ${className}`}>{children}</Tag>;
}

"use client";

import { Briefcase, GearSix, House, Pulse } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

export const NAV = [
  { href: "/", label: "Hôm nay", icon: House },
  { href: "/work", label: "Công việc", icon: Briefcase },
  { href: "/settings", label: "Cài đặt", icon: GearSix },
  { href: "/health", label: "Tình trạng", icon: Pulse },
] as const;

export function activeIndex(pathname: string): number {
  return NAV.findIndex((l) => (l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`)));
}

/** Desktop segmented nav; the pill slides to the current page (transform + width on one absolutely placed node). */
export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const idx = activeIndex(pathname);
  const wrap = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);

  useLayoutEffect(() => {
    const place = () => {
      const el = links.current[idx];
      const p = pill.current;
      if (!p) return;
      if (!el) {
        p.style.opacity = "0";
        return;
      }
      p.style.opacity = "";
      p.style.width = `${el.offsetWidth}px`;
      p.style.transform = `translateX(${el.offsetLeft}px)`;
      requestAnimationFrame(() => p.classList.add("ready"));
    };
    place();
    window.addEventListener("resize", place);
    // fonts load after first paint and change link widths
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [idx]);

  return (
    <nav
      ref={wrap}
      aria-label="Điều hướng chính"
      className={`relative gap-0.5 rounded-xl border border-line bg-surface p-1 text-sm ${className}`}
    >
      <span ref={pill} className="nav-pill" aria-hidden />
      {NAV.map((l, i) => (
        <Link
          key={l.href}
          href={l.href}
          ref={(el) => {
            links.current[i] = el;
          }}
          aria-current={i === idx ? "page" : undefined}
          className={`relative z-[1] rounded-lg px-3.5 py-1.5 font-medium whitespace-nowrap transition-colors ${
            i === idx ? "text-bg" : "text-ink-2 hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile bottom tab bar: floating, glass, safe-area aware, with a springy sliding indicator. */
export function TabBar() {
  const pathname = usePathname();
  const idx = activeIndex(pathname);
  return (
    <nav className="tabbar md:hidden" aria-label="Điều hướng chính">
      <div className="relative grid grid-cols-4 p-1.5">
        <span
          className="tab-ind"
          aria-hidden
          style={{ transform: `translateX(${Math.max(idx, 0) * 100}%)`, opacity: idx < 0 ? 0 : 1 }}
        />
        {NAV.map((l, i) => {
          const Icon = l.icon;
          const active = i === idx;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors ${
                active ? "text-accent-deep" : "text-ink-3"
              }`}
            >
              <Icon size={24} weight={active ? "fill" : "regular"} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

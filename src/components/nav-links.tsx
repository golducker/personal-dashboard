"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hôm nay" },
  { href: "/settings", label: "Cài đặt" },
  { href: "/health", label: "Tình trạng" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-0.5 rounded-xl border border-line bg-surface p-1 text-sm sm:mx-auto">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 whitespace-nowrap transition ${
              active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

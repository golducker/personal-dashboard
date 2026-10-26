"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { Mascot } from "./mascot";
import { NAV, NavLinks, TabBar, activeIndex } from "./nav-links";
import { ScrollProgress } from "./scroll-progress";
import { ThemeToggle } from "./theme-toggle";

const PUBLIC = ["/login", "/privacy", "/offline"];

/**
 * Persistent app chrome, mounted once in the root layout (so the nav pill can slide between pages).
 * Desktop: fixed glass header, compacts on scroll. Mobile: slim header + floating bottom tab bar.
 * Hidden on the public pages (login, privacy, offline).
 */
export function AppChrome() {
  const pathname = usePathname();
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const idx = activeIndex(pathname);

  return (
    <>
      <ScrollProgress />
      <div className="chrome-spacer" aria-hidden />
      <header className="chrome-bar">
        <div className="chrome-bg" aria-hidden />
        <div className="chrome-inner mx-auto w-full max-w-7xl px-4 sm:px-6">
          <Mascot size="sm" label="Linh vật" />
          <Link href="/" className="font-display hidden text-lg font-bold tracking-tight md:block">
            Dashboard
          </Link>
          <span className="chrome-title font-display min-w-0 flex-1 truncate text-lg font-bold tracking-tight md:hidden">
            {idx >= 0 ? NAV[idx].label : "Dashboard"}
          </span>
          <NavLinks className="mx-auto hidden md:flex" />
          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <ThemeToggle />
            {/* Desktop only: on phones it sat next to the theme toggle and was easy to hit by mistake (Settings has it). */}
            <span className="hidden md:contents">
              <LogoutButton />
            </span>
          </div>
        </div>
      </header>
      <TabBar />
    </>
  );
}

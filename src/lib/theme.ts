// Theme state lives on <html data-theme> (absent = follow the system) and in the `theme` cookie,
// which layout.tsx reads so the server renders the right world on the first paint. Client only.
import { sfx } from "./sfx";

export type ThemeMode = "system" | "light" | "dark";
export const THEME_COLORS = { light: "#FFF6D6", dark: "#0C0814" } as const;
export const THEME_LABELS: Record<ThemeMode, string> = { system: "Tự động", light: "Sáng", dark: "Tối" };
export const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };

const EVENT = "themechange";

export function getThemeMode(): ThemeMode {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

export function subscribeTheme(l: () => void) {
  window.addEventListener(EVENT, l);
  return () => window.removeEventListener(EVENT, l);
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = mode;
  document.cookie = `theme=${mode}; path=/; max-age=31536000; samesite=lax`;
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (meta.dataset.media === undefined) meta.dataset.media = meta.getAttribute("media") ?? "";
    if (mode === "system") {
      const media = meta.dataset.media;
      if (media) {
        meta.setAttribute("media", media);
        meta.content = media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light;
      } else {
        meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
      }
    } else {
      meta.removeAttribute("media");
      meta.content = THEME_COLORS[dark ? "dark" : "light"];
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Change theme; with an origin element the new world is revealed as a growing circle. */
export function setThemeMode(mode: ThemeMode, origin?: Element | null) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  sfx.theme();
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!origin || reduced || !doc.startViewTransition) {
    applyMode(mode);
    return;
  }
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = doc.startViewTransition(() => applyMode(mode));
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}

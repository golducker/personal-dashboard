"use client";

import { Check } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { call } from "./api-client";

type Cal = { id: string; name: string; color: string };

// Distinct hues on a dark wallpaper; no orange, which the wallpaper uses for "today".
const PRESETS = ["#4986e7", "#8e63ce", "#00acc1", "#43a047", "#e45aa6", "#78909c", "#c0ca33", "#e53935", "#5c6bc0", "#b8b8b8"];

/** One color per calendar; used by the dashboard and the wallpaper API. Saves 400 ms after the last change. */
export function CalendarColors({ calendars }: { calendars: Cal[] }) {
  const [colors, setColors] = useState(() => Object.fromEntries(calendars.map((c) => [c.id, c.color])));
  const [status, setStatus] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function pick(id: string, color: string) {
    setColors((m) => ({ ...m, [id]: color }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const res = await call("PATCH", "/api/calendar/calendars", { id, color });
      setStatus(res.ok ? { id, text: "Đã lưu", ok: true } : { id, text: res.error, ok: false });
    }, 400);
  }

  const used = (id: string, color: string) => calendars.some((c) => c.id !== id && colors[c.id]?.toLowerCase() === color.toLowerCase());

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium">Màu từng lịch</p>
        <p className="text-xs text-ink-3">Bấm một màu có sẵn, hoặc ô cuối để chọn màu bất kỳ. Màu này dùng cho dashboard và hình nền.</p>
      </div>
      <ul className="space-y-3">
        {calendars.map((c) => {
          const current = colors[c.id];
          return (
            <li key={c.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: current }} />
                <span className="truncate font-medium">{c.name}</span>
                <span className="font-mono text-xs text-ink-3">{current}</span>
                {used(c.id, current) && <span className="text-xs text-danger">trùng màu lịch khác</span>}
                {status?.id === c.id && <span className={`text-xs ${status.ok ? "text-accent-deep" : "text-danger"}`}>{status.text}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`Màu lịch ${c.name}`}>
                {PRESETS.map((p) => {
                  const on = p === current.toLowerCase();
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={p}
                      title={used(c.id, p) ? `${p} (lịch khác đang dùng)` : p}
                      onClick={() => pick(c.id, p)}
                      className={`grid size-8 place-items-center rounded-full border-2 transition ${on ? "border-ink" : "border-transparent"} ${used(c.id, p) && !on ? "opacity-35" : ""}`}
                      style={{ background: p }}
                    >
                      {on && <Check size={14} weight="bold" className="text-white" />}
                    </button>
                  );
                })}
                <input
                  type="color"
                  value={current}
                  onChange={(e) => pick(c.id, e.target.value)}
                  title="Chọn màu khác"
                  aria-label={`Màu khác cho lịch ${c.name}`}
                  className="size-8 cursor-pointer rounded-full border border-line-strong bg-transparent"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

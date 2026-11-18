"use client";

import { useRef, useState } from "react";
import { call } from "./api-client";

type Cal = { id: string; name: string; color: string };

/** One color per calendar; used by the dashboard and the wallpaper API. Saves 400 ms after the last change. */
export function CalendarColors({ calendars }: { calendars: Cal[] }) {
  const [colors, setColors] = useState(() => Object.fromEntries(calendars.map((c) => [c.id, c.color])));
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function pick(id: string, color: string) {
    setColors((m) => ({ ...m, [id]: color }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const res = await call("PATCH", "/api/calendar/calendars", { id, color });
      setError(res.ok ? null : res.error);
    }, 400);
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Màu từng lịch</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {calendars.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-3">
              <input
                type="color"
                value={colors[c.id]}
                onChange={(e) => pick(c.id, e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-line-strong bg-transparent"
                aria-label={`Màu lịch ${c.name}`}
              />
              <span className="truncate">{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  );
}

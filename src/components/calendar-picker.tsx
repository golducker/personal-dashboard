"use client";

import type { CalendarOption } from "@/lib/calendar";

/** Colored chips to pick which calendar (category) something goes into. */
export function CalendarPicker({
  calendars,
  value,
  onChange,
  label = "Loại lịch",
}: {
  calendars: CalendarOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  if (calendars.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {calendars.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.id)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
              on ? "border-ink bg-surface font-medium text-ink" : "border-line-strong text-ink-2 hover:text-ink"
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
            {c.primary ? "Chính" : c.name}
          </button>
        );
      })}
    </div>
  );
}


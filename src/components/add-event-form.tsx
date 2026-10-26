"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { localDateTime } from "@/lib/time";
import { call } from "./api-client";
import { BTN, BTN_PRIMARY, INPUT } from "./card";

export type CalendarOption = { id: string; name: string; primary: boolean };

export function AddEventForm({ calendars, today }: { calendars: CalendarOption[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [calendarId, setCalendarId] = useState(calendars.find((c) => c.primary)?.id ?? calendars[0]?.id ?? "primary");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await call("POST", "/api/calendar/events", {
      title,
      calendarId,
      ...(allDay
        ? { allDay: true, start: date }
        : { allDay: false, start: localDateTime(date, start), end: localDateTime(date, end) }),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setTitle("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={BTN}>
        + Sự kiện
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" className={INPUT} required autoFocus />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} !w-auto`} required />
        {!allDay && (
          <>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT} !w-auto`} required />
            <span className="text-neutral-500">–</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${INPUT} !w-auto`} required />
          </>
        )}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Cả ngày
        </label>
      </div>
      {calendars.length > 1 && (
        <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className={INPUT} aria-label="Lịch">
          {calendars.map((c) => (
            <option key={c.id} value={c.id} className="text-black">
              {c.name}
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className={BTN_PRIMARY}>Thêm</button>
        <button type="button" onClick={() => setOpen(false)} className={BTN}>Hủy</button>
      </div>
    </form>
  );
}

"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { localDateTime } from "@/lib/time";
import { call } from "./api-client";
import { BTN, BTN_GHOST, BTN_PRIMARY, INPUT } from "./card";

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
      <button onClick={() => setOpen(true)} className={`${BTN_GHOST} -ml-2`}>
        <Plus size={16} weight="bold" /> Thêm sự kiện
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl bg-surface-2 p-3">
      <label className="block space-y-1 text-xs text-ink-2">
        Tiêu đề
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} required autoFocus />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-ink-2">
          <span className="block">Ngày</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} !w-auto`} required />
        </label>
        {!allDay && (
          <>
            <label className="space-y-1 text-xs text-ink-2">
              <span className="block">Bắt đầu</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT} !w-auto`} required />
            </label>
            <label className="space-y-1 text-xs text-ink-2">
              <span className="block">Kết thúc</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${INPUT} !w-auto`} required />
            </label>
          </>
        )}
        <label className="flex h-[38px] items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Cả ngày
        </label>
      </div>
      {calendars.length > 1 && (
        <label className="block space-y-1 text-xs text-ink-2">
          Lịch
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className={INPUT}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className={BTN_PRIMARY}>{busy ? "Đang thêm..." : "Thêm"}</button>
        <button type="button" onClick={() => setOpen(false)} className={BTN}>Hủy</button>
      </div>
    </form>
  );
}

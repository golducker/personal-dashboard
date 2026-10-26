"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { localDateTime } from "@/lib/time";
import type { EventView } from "@/lib/today";
import { call } from "./api-client";
import { BTN, BTN_PRIMARY, INPUT } from "./card";

type Mode = "view" | "edit" | "confirm";

export function EventItem({ event: ev }: { event: EventView }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(ev.title);
  const [date, setDate] = useState(ev.date);
  const [start, setStart] = useState(ev.startTime);
  const [end, setEnd] = useState(ev.endTime);

  const url = `/api/calendar/events/${encodeURIComponent(ev.calendarId)}/${encodeURIComponent(ev.id)}`;

  async function run(fn: () => ReturnType<typeof call>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setMode("view");
    router.refresh();
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    const times = ev.allDay
      ? { allDay: true, start: date }
      : { allDay: false, start: localDateTime(date, start), end: localDateTime(date, end) };
    return run(() => call("PATCH", url, { title, times }));
  }

  return (
    <li className="py-2">
      {mode === "edit" ? (
        <form onSubmit={onSave} className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} aria-label="Tiêu đề" required />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} !w-auto`} required />
            {!ev.allDay && (
              <>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT} !w-auto`} required />
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${INPUT} !w-auto`} required />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className={BTN_PRIMARY}>Lưu</button>
            <button type="button" onClick={() => setMode("view")} className={BTN}>Hủy</button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ev.color }} title={ev.calendarName} />
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium">{ev.title}</p>
            <p className="text-sm text-neutral-500">
              {ev.when}
              {ev.location ? ` · ${ev.location}` : ""}
            </p>
          </div>
          {mode === "confirm" ? (
            <div className="flex shrink-0 items-center gap-1.5 text-sm">
              <span className="text-neutral-500">Xóa?</span>
              <button disabled={busy} onClick={() => run(() => call("DELETE", url))} className="rounded-lg bg-red-600 px-2.5 py-1 font-medium text-white disabled:opacity-50">
                Xóa
              </button>
              <button onClick={() => setMode("view")} className={BTN}>Giữ</button>
            </div>
          ) : (
            <div className="flex shrink-0 gap-1 text-sm">
              <button onClick={() => setMode("edit")} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10">Sửa</button>
              <button onClick={() => setMode("confirm")} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10">Xóa</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}

"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { localDateTime } from "@/lib/time";
import type { EventView } from "@/lib/today";
import { call } from "./api-client";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_PRIMARY, INPUT } from "./card";

type Mode = "view" | "edit" | "confirm";

const ICON_BTN = "grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink";

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

  if (mode === "edit") {
    return (
      <li className="rounded-xl bg-surface-2 p-3">
        <form onSubmit={onSave} className="space-y-2">
          <label className="block space-y-1 text-xs text-ink-2">
            Tiêu đề
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} required />
          </label>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} !w-auto`} aria-label="Ngày" required />
            {!ev.allDay && (
              <>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT} !w-auto`} aria-label="Bắt đầu" required />
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${INPUT} !w-auto`} aria-label="Kết thúc" required />
              </>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button disabled={busy} className={BTN_PRIMARY}>{busy ? "Đang lưu..." : "Lưu"}</button>
            <button type="button" onClick={() => setMode("view")} className={BTN}>Hủy</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2">
      <span className="w-12 shrink-0 pt-0.5 font-mono text-xs leading-5 text-ink-2">
        {ev.allDay ? (
          "Cả ngày"
        ) : (
          <>
            {ev.startTime}
            <br />
            <span className="text-ink-3">{ev.endTime}</span>
          </>
        )}
      </span>
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: ev.color }} title={ev.calendarName} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 font-medium break-words">{ev.title}</p>
        <p className="text-xs text-ink-2">
          {ev.location ? `${ev.location}, ` : ""}
          {ev.calendarName}
        </p>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      {mode === "confirm" ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button disabled={busy} onClick={() => run(() => call("DELETE", url))} className={BTN_DANGER}>
            Xóa
          </button>
          <button onClick={() => setMode("view")} className={BTN_GHOST}>Giữ</button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-0.5 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button onClick={() => setMode("edit")} className={ICON_BTN} aria-label={`Sửa ${ev.title}`} title="Sửa">
            <PencilSimple size={16} />
          </button>
          <button onClick={() => setMode("confirm")} className={ICON_BTN} aria-label={`Xóa ${ev.title}`} title="Xóa">
            <Trash size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

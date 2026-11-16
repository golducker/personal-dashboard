"use client";

import { Fire, Plus, Trash } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { DailyItem } from "@/lib/daily";
import { sfx } from "@/lib/sfx";
import { burst, burstFrom } from "@/lib/vfx";
import { call } from "./api-client";
import { BTN_GHOST, BTN_PRIMARY, Empty, INPUT, Panel } from "./card";
import { showToast } from "./toast";

/** Fireworks around an element: a few staggered bursts on its centre and edges. */
function celebrate(el: Element | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const spots = [
    [0.5, 0.5],
    [0, 0.2],
    [1, 0.2],
    [0.2, 1],
    [0.8, 1],
  ];
  spots.forEach(([fx, fy], i) => setTimeout(() => burst(r.left + r.width * fx, r.top + r.height * fy), i * 110));
}

export function DailyChecklist({ items: initialItems, streakBefore }: { items: DailyItem[]; streakBefore: number }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [popKey, setPopKey] = useState(0); // bumps to replay the streak +1 animation
  const flame = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const doneCount = items.filter((i) => i.done).length;
  const full = items.length > 0 && doneCount === items.length;
  const streak = streakBefore + (full ? 1 : 0);
  const left = items.length - doneCount;

  function setDone(id: string, done: boolean) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done } : x)));
  }

  async function toggle(item: DailyItem, e: MouseEvent<HTMLButtonElement>) {
    const done = !item.done;
    const box = e.currentTarget.querySelector("[data-box]");
    const fills = done && doneCount + 1 === items.length;
    setDone(item.id, done);
    if (!done) sfx.undo();
    else if (!fills) {
      sfx.toggle();
      burstFrom(box);
    } else {
      sfx.success();
      burstFrom(box);
      setPopKey((k) => k + 1);
      celebrate(flame.current);
      setTimeout(() => celebrate(bar.current), 250);
    }

    const r = await call("PATCH", `/api/daily/${item.id}`, { done });
    if (!r.ok) {
      setDone(item.id, !done);
      showToast({ message: r.error, tone: "error" });
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const r = await call("POST", "/api/daily", { title });
    setBusy(false);
    if (!r.ok) return showToast({ message: r.error, tone: "error" });
    setItems((xs) => [...xs, r.data.item as DailyItem]);
    setTitle("");
  }

  async function remove(item: DailyItem) {
    if (!confirm(`Xoá "${item.title}" khỏi danh sách hằng ngày?`)) return;
    const r = await call("DELETE", `/api/daily/${item.id}`);
    if (!r.ok) return showToast({ message: r.error, tone: "error" });
    setItems((xs) => xs.filter((x) => x.id !== item.id));
  }

  return (
    <div className="space-y-5">
      <section className={`card streak-card p-5 ${full ? "is-full" : ""}`}>
        <div className="flex items-center gap-4">
          <div ref={flame} className={`streak-flame ${full ? "lit" : streak > 0 ? "warm" : ""}`} aria-hidden>
            <Fire weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative flex items-baseline gap-2">
              <span key={popKey} className={`font-display text-4xl leading-none font-bold tabular-nums ${popKey ? "streak-pop" : ""}`}>
                {streak}
              </span>
              <span className="text-sm font-medium text-ink-2">ngày liên tiếp</span>
              {popKey > 0 && full && (
                <span key={`p${popKey}`} className="streak-plus" aria-hidden>
                  +1
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-3" aria-live="polite">
              {items.length === 0
                ? "Thêm việc hằng ngày để bắt đầu chuỗi."
                : full
                  ? "Hôm nay xong hết rồi, chuỗi được giữ!"
                  : `Còn ${left} việc nữa là chuỗi +1.`}
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <div
            ref={bar}
            className="streak-bar mt-4"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label="Tiến độ hôm nay"
          >
            {items.map((i) => (
              <span key={i.id} className={`streak-seg ${i.done ? "on" : ""}`}>
                <i />
              </span>
            ))}
          </div>
        )}
      </section>

      <Panel title="Hôm nay" meta={`${doneCount}/${items.length}`}>
        {items.length === 0 ? (
          <Empty>Chưa có việc hằng ngày. Thêm ở dưới.</Empty>
        ) : (
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <button
                  onClick={(e) => toggle(i, e)}
                  aria-pressed={i.done}
                  className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                >
                  <span
                    data-box
                    data-pop={i.done ? "" : undefined}
                    className={`grid size-6 shrink-0 place-items-center rounded-md border transition-colors ${
                      i.done ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
                    }`}
                    aria-hidden
                  >
                    {i.done && (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          pathLength={1}
                          stroke="currentColor"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="draw-check"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={`transition-colors ${i.done ? "text-ink-3 line-through" : ""}`}>{i.title}</span>
                </button>
                <button onClick={() => remove(i)} aria-label={`Xoá ${i.title}`} className={`${BTN_GHOST} px-2 text-ink-3`}>
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Thêm việc hằng ngày"
            className={INPUT}
            aria-label="Việc hằng ngày"
            maxLength={200}
          />
          <button disabled={busy || !title.trim()} className={`${BTN_PRIMARY} shrink-0`}>
            <Plus size={16} weight="bold" /> Thêm
          </button>
        </form>
      </Panel>
    </div>
  );
}

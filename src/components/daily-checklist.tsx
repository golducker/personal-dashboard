"use client";

import { Lightning, Plus, Trash } from "@phosphor-icons/react";
import { useState, type FormEvent, type MouseEvent } from "react";
import { levelOf, XP_PER_TICK, type DailyItem } from "@/lib/daily";
import { sfx } from "@/lib/sfx";
import { burstFrom } from "@/lib/vfx";
import { call } from "./api-client";
import { BTN_GHOST, BTN_PRIMARY, Empty, INPUT, Panel } from "./card";
import { showToast } from "./toast";

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DailyChecklist({ items: initialItems, xp: initialXp }: { items: DailyItem[]; xp: number }) {
  const [items, setItems] = useState(initialItems);
  const [xp, setXp] = useState(initialXp);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const lv = levelOf(xp);
  const doneCount = items.filter((i) => i.done).length;

  async function toggle(item: DailyItem, e: MouseEvent<HTMLButtonElement>) {
    const done = !item.done;
    const nextXp = xp + (done ? XP_PER_TICK : -XP_PER_TICK);
    const el = e.currentTarget;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done } : x)));
    setXp(nextXp);
    const r = await call("PATCH", `/api/daily/${item.id}`, { done });
    if (!r.ok) {
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: !done } : x)));
      setXp((v) => v - (nextXp - xp));
      return showToast({ message: r.error, tone: "error" });
    }
    if (!done) return sfx.undo();
    sfx.success();
    burstFrom(el);
    const up = levelOf(nextXp).level > lv.level;
    const allDone = doneCount + 1 === items.length;
    if (up) showToast({ message: `Lên cấp ${levelOf(nextXp).level}! 🎉` });
    else if (allDone) showToast({ message: "Xong hết việc hôm nay!" });
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
      <section className="card p-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-2 font-display text-2xl font-bold">
            <Lightning weight="fill" className="text-accent" /> Cấp {lv.level}
          </span>
          <span className="tabular font-mono text-xs text-ink-2">
            {lv.into}/{lv.need} XP · tổng {xp}
          </span>
        </div>
        <Bar value={lv.into} max={lv.need} label={`Kinh nghiệm cấp ${lv.level}`} />
        <p className="mt-2 text-xs text-ink-3">Mỗi việc tick xong +{XP_PER_TICK} XP. Sang ngày mới danh sách tự bỏ tick.</p>
      </section>

      <Panel title="Hôm nay" meta={`${doneCount}/${items.length}`}>
        {items.length > 0 && (
          <div className="mb-4">
            <Bar value={doneCount} max={items.length} label="Tiến độ hôm nay" />
          </div>
        )}
        {items.length === 0 ? (
          <Empty>Chưa có việc hằng ngày. Thêm ở dưới.</Empty>
        ) : (
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id} className="group flex items-center gap-2">
                <button
                  onClick={(e) => toggle(i, e)}
                  aria-pressed={i.done}
                  className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-md border text-sm ${
                      i.done ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
                    }`}
                    aria-hidden
                  >
                    {i.done && "✓"}
                  </span>
                  <span className={i.done ? "text-ink-3 line-through" : ""}>{i.title}</span>
                </button>
                <button onClick={() => remove(i)} aria-label={`Xoá ${i.title}`} className={`${BTN_GHOST} px-2 text-ink-3`}>
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thêm việc hằng ngày" className={INPUT} aria-label="Việc hằng ngày" maxLength={200} />
          <button disabled={busy || !title.trim()} className={`${BTN_PRIMARY} shrink-0`}>
            <Plus size={16} weight="bold" /> Thêm
          </button>
        </form>
      </Panel>
    </div>
  );
}

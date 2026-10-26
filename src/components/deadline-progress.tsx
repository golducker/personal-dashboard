"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleHalf, Pause } from "@phosphor-icons/react";
import {
  PROGRESS_LABELS,
  PROGRESS_VALUES,
  effectiveProgress,
  type ProgressInput,
  type ProgressState,
} from "@/lib/drive/progress";
import { sfx } from "@/lib/sfx";
import { burstFrom } from "@/lib/vfx";
import { showToast } from "./toast";

const ICONS: Record<ProgressState, ReactNode> = {
  todo: <Circle weight="bold" />,
  ongoing: <CircleHalf weight="fill" />,
  done: (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" aria-hidden>
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
  ),
  postponed: <Pause weight="fill" />,
};

const TONE: Record<ProgressState, string> = {
  todo: "border border-line-strong text-ink-3",
  ongoing: "border border-accent text-accent-strong",
  done: "border border-accent bg-accent text-accent-ink",
  postponed: "border border-warn bg-warn-soft text-warn",
};

type PatchResult = { ok: true; previous: ProgressInput } | { ok: false; error: string };

async function patchProgress(id: string, progress: ProgressInput): Promise<PatchResult> {
  try {
    const res = await fetch(`/api/deadlines/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `Lỗi ${res.status}` };
    return { ok: true, previous: data.previous ?? null };
  } catch {
    return { ok: false, error: "Không thể kết nối tới máy chủ." };
  }
}

const stateName = (p: ProgressInput) => (p ? PROGRESS_LABELS[p].toLowerCase() : "theo sheet");
const shorten = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

export function DeadlineProgress({
  id,
  title,
  progress,
  sheetDone,
}: {
  id: string;
  title: string;
  progress: ProgressInput;
  sheetDone: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ProgressInput>(progress);
  const [seen, setSeen] = useState<ProgressInput>(progress);
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // follow the server after router.refresh()
  if (progress !== seen) {
    setSeen(progress);
    setValue(progress);
  }

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function apply(next: ProgressInput) {
    const before = value;
    setValue(next); // optimistic
    setPop(next === "done");
    if (next === "done") {
      sfx.success();
      burstFrom(triggerRef.current);
    } else {
      sfx.toggle();
    }
    const res = await patchProgress(id, next);
    if (!res.ok) {
      setValue(before);
      setPop(false);
      showToast({ message: res.error, tone: "error" });
      return;
    }
    router.refresh();
    const previous = res.previous;
    showToast({
      message: `Đã đánh dấu “${shorten(title)}” là ${stateName(next)}`,
      action: {
        label: "Hoàn tác",
        // undo does not offer another undo
        run: async () => {
          setValue(previous);
          setPop(false);
          const back = await patchProgress(id, previous);
          if (!back.ok) {
            setValue(next);
            showToast({ message: back.error, tone: "error" });
            return;
          }
          router.refresh();
        },
      },
    });
  }

  function choose(next: ProgressInput) {
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== value) void apply(next);
  }

  function onMenuKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  const shown = effectiveProgress(value, sheetDone);
  const fromSheet = value === null;

  return (
    <span ref={rootRef} className="relative -my-1 -ml-1 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Tiến độ: ${PROGRESS_LABELS[shown]}${fromSheet ? " (theo sheet)" : ""}. Đổi tiến độ`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-8 items-center justify-center rounded-full before:absolute before:-inset-2 before:content-['']"
      >
        <span
          data-pop={pop && shown === "done" ? "" : undefined}
          className={`relative flex size-5 items-center justify-center rounded-full text-[13px] transition ${TONE[shown]} ${fromSheet ? "opacity-60" : ""}`}
        >
          {ICONS[shown]}
          {fromSheet && <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-ink-3 ring-2 ring-surface" aria-hidden />}
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Đặt tiến độ"
          onKeyDown={onMenuKey}
          className="toast-in absolute top-full left-0 z-30 mt-1 w-48 rounded-2xl border border-line-strong bg-surface p-1.5 shadow-pop"
        >
          {PROGRESS_VALUES.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              data-sfx="none"
              onClick={() => choose(p)}
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none ${value === p ? "font-semibold" : ""}`}
            >
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[13px] ${TONE[p]}`}>{ICONS[p]}</span>
              <span className="flex-1">{PROGRESS_LABELS[p]}</span>
              {value === p && <Check weight="bold" className="text-accent-strong" aria-label="Đang chọn" />}
            </button>
          ))}
          {value !== null && (
            <button
              type="button"
              role="menuitem"
              data-sfx="none"
              onClick={() => choose(null)}
              className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl border-t border-line px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              Theo sheet
            </button>
          )}
        </div>
      )}
    </span>
  );
}

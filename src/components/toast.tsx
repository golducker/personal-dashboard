"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { sfx } from "@/lib/sfx";
import { BTN_GHOST } from "./card";

export type ToastData = {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
};

const DURATION_MS = 6000;
const ACTION_DURATION_MS = 8000;

// Tiny module-level store: one toast at a time, a newer one replaces the older.
let current: ToastData | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function set(next: ToastData | null) {
  current = next;
  for (const l of listeners) l();
}

export function showToast(t: Omit<ToastData, "id" | "tone"> & { tone?: ToastData["tone"] }) {
  if (t.tone === "error") sfx.error();
  set({ tone: "info", ...t, id: ++seq });
}

export function dismissToast(id?: number) {
  if (id === undefined || current?.id === id) set(null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Mounted once in the root layout. */
export function ToastHost() {
  const toast = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  // Keyed by toast id so a pause never leaks into the next toast (pointerleave doesn't fire when it unmounts).
  const [pausedId, setPausedId] = useState<number | null>(null);
  const paused = toast !== null && pausedId === toast.id;
  const setPaused = (on: boolean) => setPausedId(on && toast ? toast.id : null);

  useEffect(() => {
    if (!toast || paused) return;
    // Undo toasts get longer; the timer restarts after a hover/focus pause.
    const timer = setTimeout(() => dismissToast(toast.id), toast.action ? ACTION_DURATION_MS : DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  if (!toast) return null;
  const action = toast.action;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-[var(--z-toast)] flex justify-center px-4 md:bottom-6">
      <div
        key={toast.id}
        role={toast.tone === "error" ? "alert" : "status"}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={`toast-in card pointer-events-auto flex max-w-md items-center gap-3 !rounded-2xl border bg-surface py-2 pr-2 pl-4 text-sm shadow-pop ${toast.tone === "error" ? "border-danger text-danger" : "border-line-strong text-ink"}`}
      >
        <span className="min-w-0 break-words">{toast.message}</span>
        {action && (
          <button
            type="button"
            className={`${BTN_GHOST} shrink-0 font-semibold text-accent-strong`}
            data-sfx="none"
            onClick={() => {
              dismissToast(toast.id);
              sfx.undo();
              action.run();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

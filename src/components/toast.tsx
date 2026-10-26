"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BTN_GHOST } from "./card";

export type ToastData = {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
};

const DURATION_MS = 6000;

// Tiny module-level store: one toast at a time, a newer one replaces the older.
let current: ToastData | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function set(next: ToastData | null) {
  current = next;
  for (const l of listeners) l();
}

export function showToast(t: Omit<ToastData, "id" | "tone"> & { tone?: ToastData["tone"] }) {
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const action = toast.action;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        key={toast.id}
        role={toast.tone === "error" ? "alert" : "status"}
        className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-surface py-2 pr-2 pl-4 text-sm shadow-panel ${toast.tone === "error" ? "border-danger text-danger" : "border-line-strong text-ink"}`}
      >
        <span className="min-w-0 break-words">{toast.message}</span>
        {action && (
          <button
            type="button"
            className={`${BTN_GHOST} shrink-0 font-semibold text-accent`}
            onClick={() => {
              dismissToast(toast.id);
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

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TaskView } from "@/lib/today";
import { call } from "./api-client";
import { BTN } from "./card";

const RING = {
  4: "border-red-500",
  3: "border-orange-500",
  2: "border-blue-500",
  1: "border-neutral-400",
} as const;

function Row({ task, overdue, onClose }: { task: TaskView; overdue?: boolean; onClose: (t: TaskView) => void }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <button
        onClick={() => onClose(task)}
        aria-label={`Hoàn thành: ${task.content}`}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition hover:bg-black/10 dark:hover:bg-white/15 ${RING[task.priority]}`}
      />
      <div className="min-w-0 flex-1">
        <p className="break-words">{task.content}</p>
        <p className="text-xs text-neutral-500">
          {task.dueLabel && <span className={overdue ? "text-red-600 dark:text-red-400" : ""}>{task.dueLabel}</span>}
          {task.dueLabel && task.projectName ? " · " : ""}
          {task.projectName}
        </p>
      </div>
    </li>
  );
}

export function TaskList({ overdue, today, later }: { overdue: TaskView[]; today: TaskView[]; later: TaskView[] }) {
  const router = useRouter();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<TaskView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const mark = (id: string, isClosed: boolean) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (isClosed) next.add(id);
      else next.delete(id);
      return next;
    });

  async function onClose(task: TaskView) {
    mark(task.id, true);
    setToast(task);
    setError(null);
    const r = await call("POST", `/api/todoist/tasks/${task.id}/close`);
    if (!r.ok) {
      mark(task.id, false);
      setToast(null);
      return setError(r.error);
    }
    router.refresh();
  }

  async function onUndo() {
    if (!toast) return;
    const task = toast;
    setToast(null);
    const r = await call("POST", `/api/todoist/tasks/${task.id}/reopen`);
    if (!r.ok) return setError(r.error);
    mark(task.id, false);
    router.refresh();
  }

  const visible = (list: TaskView[]) => list.filter((t) => !closed.has(t.id));
  const o = visible(overdue);
  const t = visible(today);
  const l = visible(later);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {o.length + t.length === 0 ? (
        <p className="text-sm text-neutral-500">Không còn việc nào cho hôm nay.</p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {o.map((x) => (
            <Row key={x.id} task={x} overdue onClose={onClose} />
          ))}
          {t.map((x) => (
            <Row key={x.id} task={x} onClose={onClose} />
          ))}
        </ul>
      )}
      {l.length > 0 && (
        <details className="border-t border-black/5 pt-3 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-medium">
            Sắp tới <span className="font-normal text-neutral-500">({l.length})</span>
          </summary>
          <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
            {l.map((x) => (
              <Row key={x.id} task={x} onClose={onClose} />
            ))}
          </ul>
        </details>
      )}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-10 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          <span className="truncate">Đã hoàn thành: {toast.content}</span>
          <button onClick={onUndo} className={`${BTN} shrink-0 !border-white/30 !text-white hover:!bg-white/10 dark:!border-black/30 dark:!text-neutral-900 dark:hover:!bg-black/10`}>
            Hoàn tác
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sfx } from "@/lib/sfx";
import { burstFrom } from "@/lib/vfx";
import type { TaskView } from "@/lib/today";
import { call } from "./api-client";
import { Empty } from "./card";
import { dismissToast, showToast } from "./toast";

// Todoist priority (4 = urgent) mapped onto the semantic palette.
const RING = {
  4: "border-danger",
  3: "border-warn",
  2: "border-accent",
  1: "border-line-strong",
} as const;

function Row({ task, overdue, onClose }: { task: TaskView; overdue?: boolean; onClose: (t: TaskView, el: Element) => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2">
      <button
        onClick={(e) => onClose(task, e.currentTarget)}
        aria-label={`Hoàn thành: ${task.content}`}
        data-sfx="none"
        className={`relative mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 text-transparent transition-[color,transform] before:absolute before:-inset-3 before:content-[''] hover:text-ink-2 active:scale-90 ${RING[task.priority]}`}
      >
        <Check size={11} weight="bold" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 break-words">{task.content}</p>
        {(task.dueLabel || task.projectName) && (
          <p className="text-xs text-ink-2">
            {task.dueLabel && <span className={overdue ? "font-medium text-danger" : ""}>{task.dueLabel}</span>}
            {task.dueLabel && task.projectName ? ", " : ""}
            {task.projectName}
          </p>
        )}
      </div>
    </li>
  );
}

export function TaskList({ overdue, today, later }: { overdue: TaskView[]; today: TaskView[]; later: TaskView[] }) {
  const router = useRouter();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mark = (id: string, isClosed: boolean) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (isClosed) next.add(id);
      else next.delete(id);
      return next;
    });

  async function onUndo(task: TaskView) {
    const r = await call("POST", `/api/todoist/tasks/${task.id}/reopen`);
    if (!r.ok) return setError(r.error);
    mark(task.id, false);
    router.refresh();
  }

  async function onClose(task: TaskView, el: Element) {
    burstFrom(el);
    sfx.success();
    mark(task.id, true);
    showToast({ message: `Đã xong: ${task.content}`, action: { label: "Hoàn tác", run: () => void onUndo(task) } });
    setError(null);
    const r = await call("POST", `/api/todoist/tasks/${task.id}/close`);
    if (!r.ok) {
      mark(task.id, false);
      dismissToast();
      return setError(r.error);
    }
    router.refresh();
  }

  const visible = (list: TaskView[]) => list.filter((t) => !closed.has(t.id));
  const o = visible(overdue);
  const t = visible(today);
  const l = visible(later);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {o.length + t.length === 0 ? (
        <Empty>Hết việc cho hôm nay.</Empty>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {o.map((x) => (
            <Row key={x.id} task={x} overdue onClose={onClose} />
          ))}
          {t.map((x) => (
            <Row key={x.id} task={x} onClose={onClose} />
          ))}
        </ul>
      )}
      {l.length > 0 && (
        <details className="border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-2 hover:text-ink">
            Sắp tới <span className="font-normal text-ink-3">({l.length})</span>
          </summary>
          <ul className="-mx-2 mt-2 space-y-0.5">
            {l.map((x) => (
              <Row key={x.id} task={x} onClose={onClose} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

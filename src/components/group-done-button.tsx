"use client";

import { Checks } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ProgressInput } from "@/lib/drive/progress";
import { sfx } from "@/lib/sfx";
import { burstFrom } from "@/lib/vfx";
import { showToast } from "./toast";

type Item = { id: string; progress: ProgressInput };
type BulkResult = { ok: true; previous: Item[] } | { ok: false; error: string };

async function patchMany(items: Item[]): Promise<BulkResult> {
  try {
    const res = await fetch("/api/deadlines", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `Lỗi ${res.status}` };
    return { ok: true, previous: data.previous ?? [] };
  } catch {
    return { ok: false, error: "Không thể kết nối tới máy chủ." };
  }
}

const shorten = (s: string) => (s.length > 32 ? `${s.slice(0, 31)}…` : s);

/**
 * "Xong hết" for one event/category: asks inline first (it touches several rows), then marks every open task done,
 * with a single undo that restores each task's previous progress.
 */
export function GroupDoneButton({ label, ids }: { label: string; ids: string[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);

  if (ids.length === 0) return null;

  async function markAll() {
    setBusy(true);
    const res = await patchMany(ids.map((id) => ({ id, progress: "done" })));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return showToast({ message: res.error, tone: "error" });
    sfx.success();
    burstFrom(yesRef.current);
    router.refresh();
    const previous = res.previous;
    showToast({
      message: `Đã xong ${previous.length} việc của “${shorten(label)}”`,
      action: {
        label: "Hoàn tác",
        run: async () => {
          const back = await patchMany(previous);
          if (!back.ok) return showToast({ message: back.error, tone: "error" });
          router.refresh();
        },
      },
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs" role="group" aria-label={`Xác nhận xong hết ${label}`}>
        <span className="text-ink-2">Xong {ids.length} việc?</span>
        <button
          ref={yesRef}
          type="button"
          disabled={busy}
          data-sfx="none"
          onClick={() => void markAll()}
          className="btn rounded-md bg-accent px-2 py-1 font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Xong hết"}
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="btn rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          Hủy
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Đánh dấu xong tất cả ${ids.length} việc của ${label}`}
      title="Đánh dấu xong tất cả"
      className="btn inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
    >
      <Checks size={14} weight="bold" />
      Xong hết
    </button>
  );
}

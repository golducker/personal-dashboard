"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { call } from "./api-client";
import { BTN_PRIMARY, INPUT } from "./card";
import { showToast } from "./toast";

export function QuickAddTask() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    const r = await call("POST", "/api/todoist/tasks", { content, due_string: due.trim() || "hôm nay", end_time: end || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.data.queued) showToast({ message: "Đã lưu, sẽ đồng bộ khi Todoist hoạt động lại" });
    const cal = r.data.calendar as { ok: boolean; error?: string } | null;
    if (cal?.ok) showToast({ message: "Đã thêm vào lịch Daily task" });
    else if (cal) showToast({ message: `Chưa thêm được vào lịch: ${cal.error}` });
    else if (end) showToast({ message: "Hạn không có giờ nên chưa thêm vào lịch" });
    setContent("");
    setDue("");
    setEnd("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Thêm việc mới" className={INPUT} aria-label="Nội dung việc" />
        <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Hạn, vd: mai 9h" className={`${INPUT} sm:max-w-40`} aria-label="Hạn (mặc định hôm nay)" />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} title="Giờ kết thúc (time block)" className={`${INPUT} sm:max-w-32`} aria-label="Giờ kết thúc, tùy chọn" />
        <button disabled={busy || !content.trim()} className={`${BTN_PRIMARY} shrink-0`}>
          <Plus size={16} weight="bold" /> Thêm
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : <p className="text-xs text-ink-3">Để trống hạn thì tính là hôm nay. Hạn có giờ thì thêm luôn vào lịch, giờ kết thúc để chặn khung giờ (mặc định 30 phút).</p>}
    </form>
  );
}

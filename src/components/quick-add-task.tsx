"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { call } from "./api-client";
import { BTN_PRIMARY, INPUT } from "./card";

export function QuickAddTask() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    const r = await call("POST", "/api/todoist/tasks", { content, due_string: due.trim() || "hôm nay" });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setContent("");
    setDue("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Thêm việc mới…" className={INPUT} aria-label="Nội dung việc" />
        <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Hạn: mai 9h (mặc định hôm nay)" className={`${INPUT} sm:max-w-56`} aria-label="Hạn" />
        <button disabled={busy || !content.trim()} className={`${BTN_PRIMARY} shrink-0`}>Thêm</button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

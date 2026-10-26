"use client";

import { SquaresFour } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BTN_PRIMARY, CARD, INPUT } from "@/components/card";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Đăng nhập thất bại.");
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
            <SquaresFour size={18} weight="bold" />
          </span>
          Dashboard
        </div>
        <form onSubmit={onSubmit} className={`${CARD} space-y-5 p-6`}>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Đăng nhập</h1>
            <p className="text-sm text-ink-2">Nhập mã truy cập để mở bảng điều khiển.</p>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Mã truy cập</span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              aria-invalid={!!error}
              className={`${INPUT} py-2.5`}
            />
            {error && (
              <span role="alert" className="block text-sm text-danger">
                {error}
              </span>
            )}
          </label>
          <button type="submit" disabled={loading || passcode.length === 0} className={`${BTN_PRIMARY} w-full py-2.5`}>
            {loading ? "Đang kiểm tra..." : "Đăng nhập"}
          </button>
        </form>
        <p className="text-center text-xs text-ink-3">
          <a href="/privacy" className="underline-offset-2 hover:text-ink-2 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}

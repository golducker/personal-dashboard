"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BTN_PRIMARY, CARD, INPUT } from "@/components/card";
import { Mascot } from "@/components/mascot";
import { Bubble } from "@/components/mascot-speaker";
import { sfx } from "@/lib/sfx";

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
      sfx.error();
      setError(data.error ?? "Đăng nhập thất bại.");
    } catch {
      sfx.error();
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 pt-[calc(var(--safe-top)+2rem)] pb-[calc(var(--safe-bottom)+2rem)]">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Bubble
            light="Quạc… mã truy cập là gì nhỉ? Tui quên rồi."
            dark="Cửa đang khóa. Đoán sai thì tôi cười đấy."
            className="bubble-down"
          />
          <Mascot size="lg" pose="panic" className="max-sm:[--ms:140px]" />
          <p className="font-display text-xl font-bold tracking-tight">Dashboard</p>
        </div>
        <form onSubmit={onSubmit} className={`${CARD} space-y-5 p-6`}>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">Đăng nhập</h1>
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
          <button type="submit" disabled={loading || passcode.length === 0} className={`${BTN_PRIMARY} w-full`}>
            {loading ? "Đang kiểm tra..." : "Đăng nhập"}
          </button>
        </form>
        <p className="text-center text-xs text-ink-3">
          <a href="/privacy" className="inline-flex min-h-11 items-center underline-offset-2 hover:text-ink-2 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}

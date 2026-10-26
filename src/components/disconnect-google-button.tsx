"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "./api-client";
import { BTN } from "./card";

export function DisconnectGoogleButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    await call("POST", "/api/auth/google/disconnect");
    setBusy(false);
    setConfirm(false);
    router.refresh();
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className={BTN}>
        Ngắt kết nối
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">Ngắt kết nối Google?</span>
      <button disabled={busy} onClick={run} className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50">
        Ngắt
      </button>
      <button onClick={() => setConfirm(false)} className={BTN}>
        Hủy
      </button>
    </span>
  );
}

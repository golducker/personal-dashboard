"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "./api-client";
import { BTN, BTN_DANGER, BTN_GHOST } from "./card";

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
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-2">Ngắt kết nối Google?</span>
      <button disabled={busy} onClick={run} className={BTN_DANGER}>
        Ngắt
      </button>
      <button onClick={() => setConfirm(false)} className={BTN_GHOST}>
        Hủy
      </button>
    </span>
  );
}

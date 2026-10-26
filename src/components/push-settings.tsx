"use client";

import { useCallback, useEffect, useState } from "react";
import { call } from "./api-client";
import { BTN, BTN_GHOST, BTN_PRIMARY } from "./card";
import { showToast } from "./toast";

type State =
  | { kind: "loading" }
  | { kind: "not_configured" }
  | { kind: "needs_install" } // iPhone/iPad in Safari, not added to the home screen
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac with touch support
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

async function detect(vapidPublicKey: string | null): Promise<State> {
  if (!vapidPublicKey) return { kind: "not_configured" };
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? { kind: "needs_install" } : { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "denied" };
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") return { kind: "on", endpoint: sub.endpoint };
  } catch {
    /* fall through to "off" */
  }
  return { kind: "off" };
}

const STEP = "list-decimal space-y-1 pl-5 text-sm text-ink-2";

export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    detect(vapidPublicKey).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [vapidPublicKey]);

  const enable = useCallback(async () => {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      // Must be requested directly from the click for iOS to show the prompt.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "denied" } : { kind: "off" });
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const json = sub.toJSON();
      const res = await call("POST", "/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        showToast({ message: res.error, tone: "error" });
        setState({ kind: "off" });
        return;
      }
      setState({ kind: "on", endpoint: sub.endpoint });
      showToast({ message: "Đã bật thông báo trên thiết bị này." });
    } catch {
      showToast({ message: "Không bật được thông báo. Hãy thử lại.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [vapidPublicKey]);

  const disable = useCallback(async () => {
    if (state.kind !== "on") return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      const res = await call("POST", "/api/push/unsubscribe", { endpoint: state.endpoint });
      if (!res.ok) showToast({ message: res.error, tone: "error" });
      else showToast({ message: "Đã tắt thông báo trên thiết bị này." });
      setState({ kind: "off" });
    } catch {
      showToast({ message: "Không tắt được thông báo. Hãy thử lại.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [state]);

  const test = useCallback(async () => {
    setBusy(true);
    const res = await call("POST", "/api/push/test");
    setBusy(false);
    showToast(res.ok ? { message: "Đã gửi thông báo thử." } : { message: res.error, tone: "error" });
  }, []);

  const touch = "min-h-11";

  switch (state.kind) {
    case "loading":
      return <p className="text-sm text-ink-3">Đang kiểm tra…</p>;
    case "not_configured":
      return <p className="text-sm text-ink-2">Máy chủ chưa cấu hình thông báo đẩy (thiếu khóa VAPID).</p>;
    case "unsupported":
      return <p className="text-sm text-ink-2">Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.</p>;
    case "needs_install":
      return (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">Trên iPhone, thông báo chỉ hoạt động khi mở app từ icon ngoài màn hình chính (iOS 16.4 trở lên).</p>
          <ol className={STEP}>
            <li>Mở trang này bằng Safari.</li>
            <li>Bấm nút Chia sẻ, chọn &quot;Thêm vào MH chính&quot;.</li>
            <li>Mở app từ icon vừa tạo.</li>
            <li>Quay lại Cài đặt và bật thông báo ở đây.</li>
          </ol>
        </div>
      );
    case "denied":
      return (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">Thông báo đang bị chặn cho trang này. Để bật lại:</p>
          <ol className={STEP}>
            <li>iPhone: Cài đặt, Thông báo, chọn app Dashboard, bật Cho phép thông báo.</li>
            <li>Máy tính: bấm biểu tượng ổ khóa cạnh địa chỉ, chuyển Thông báo sang Cho phép.</li>
            <li>Tải lại trang rồi bấm bật ở đây.</li>
          </ol>
        </div>
      );
    case "off":
      return (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Nhận thông báo về điểm mới, deadline sắp đến hạn và lỗi đồng bộ.</p>
          <button type="button" className={`${BTN_PRIMARY} ${touch}`} disabled={busy} onClick={enable}>
            Bật thông báo
          </button>
        </div>
      );
    case "on":
      return (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Đang bật trên thiết bị này.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${BTN} ${touch}`} disabled={busy} onClick={test}>
              Gửi thử
            </button>
            <button type="button" className={`${BTN_GHOST} ${touch}`} disabled={busy} onClick={disable}>
              Tắt
            </button>
          </div>
        </div>
      );
  }
}

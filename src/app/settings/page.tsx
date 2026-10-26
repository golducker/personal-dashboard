import { GoogleLogo, ListChecks, Plugs } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/app-header";
import { BTN_PRIMARY, Panel, Pill } from "@/components/card";
import { DisconnectGoogleButton } from "@/components/disconnect-google-button";
import { getConnection } from "@/lib/google";
import { isConfigured } from "@/lib/sources";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Đã kết nối Google." },
  access_denied: { ok: false, text: "Bạn đã từ chối cấp quyền Google." },
  state_mismatch: { ok: false, text: "Phiên xác thực không khớp, vui lòng thử lại." },
  missing_code: { ok: false, text: "Google không trả về mã xác thực." },
  no_refresh_token: { ok: false, text: "Google không cấp refresh token, hãy thử kết nối lại." },
  no_email: { ok: false, text: "Không đọc được email từ Google." },
  exchange_failed: { ok: false, text: "Không đổi được mã xác thực với Google." },
};

const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/calendar": "Calendar",
  "https://www.googleapis.com/auth/drive.readonly": "Drive (đọc)",
  "https://www.googleapis.com/auth/drive.file": "Drive (file của app)",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const flash = google ? (MESSAGES[google] ?? { ok: false, text: `Lỗi kết nối Google (${google}).` }) : null;
  const conn = await getConnection().catch(() => null);
  const googleReady = isConfigured("google_calendar");
  const todoistReady = isConfigured("todoist");
  const scopes = (conn?.scopes ?? []).map((s) => SCOPE_LABELS[s]).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
      <AppHeader title="Cài đặt" subtitle="Kết nối và nguồn dữ liệu." />
      {flash && (
        <p role="status" className={`mb-5 rounded-xl px-4 py-3 text-sm ${flash.ok ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"}`}>
          {flash.text}
        </p>
      )}

      <div className="space-y-5">
        <Panel title="Google" icon={<GoogleLogo />} action={<Pill tone={conn ? "accent" : "neutral"}>{conn ? "Đã kết nối" : "Chưa kết nối"}</Pill>}>
          <div className="space-y-4">
            {!googleReady && <p className="text-sm text-ink-2">Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET.</p>}
            {conn && (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{conn.email}</p>
                {scopes.length > 0 && <p className="text-ink-2">Quyền: {scopes.join(", ")}</p>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {googleReady && (
                <a href="/api/auth/google/start" className={BTN_PRIMARY}>
                  {conn ? "Kết nối lại" : "Kết nối Google"}
                </a>
              )}
              {conn && <DisconnectGoogleButton />}
            </div>
          </div>
        </Panel>

        <Panel title="Todoist" icon={<ListChecks />} action={<Pill tone={todoistReady ? "accent" : "neutral"}>{todoistReady ? "Đã cấu hình" : "Chưa cấu hình"}</Pill>}>
          <p className="text-sm text-ink-2">
            {todoistReady ? "Dùng TODOIST_API_TOKEN từ biến môi trường." : "Thêm TODOIST_API_TOKEN vào biến môi trường."}
          </p>
        </Panel>

        <Panel title="Sắp có" icon={<Plugs />}>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>Nguồn Google Drive: dự án và deadline từ thư mục được chọn.</li>
            <li>Thông báo đẩy trên điện thoại.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

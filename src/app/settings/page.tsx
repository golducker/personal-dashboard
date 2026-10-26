import { AppHeader } from "@/components/app-header";
import { BTN_PRIMARY, CARD, SectionTitle } from "@/components/card";
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
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
      <AppHeader title="Cài đặt" subtitle="Kết nối và nguồn dữ liệu" />
      {flash && (
        <p
          role="status"
          className={`mb-4 rounded-xl p-3 text-sm ${
            flash.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          }`}
        >
          {flash.text}
        </p>
      )}

      <div className="space-y-6">
        <section className="space-y-3">
          <SectionTitle>Tài khoản</SectionTitle>
          <article className={`${CARD} space-y-3 p-4`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">Google (Calendar + Drive)</h3>
              <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium dark:bg-neutral-800">
                {conn ? "Đã kết nối" : "Chưa kết nối"}
              </span>
            </div>
            {!googleReady && <p className="text-sm text-neutral-500">Thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.</p>}
            {conn && (
              <p className="text-sm text-neutral-500">
                {conn.email}
                {scopes.length ? ` · ${scopes.join(", ")}` : ""}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {googleReady && (
                <a href="/api/auth/google/start" className={BTN_PRIMARY}>
                  {conn ? "Kết nối lại" : "Kết nối Google"}
                </a>
              )}
              {conn && <DisconnectGoogleButton />}
            </div>
            <p className="text-xs text-neutral-500">
              Ứng dụng đang ở chế độ Testing: phiên Google hết hạn sau 7 ngày, khi đó hãy bấm “Kết nối lại”.
            </p>
          </article>

          <article className={`${CARD} space-y-1 p-4`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">Todoist</h3>
              <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium dark:bg-neutral-800">
                {todoistReady ? "Đã cấu hình" : "Chưa cấu hình"}
              </span>
            </div>
            <p className="text-sm text-neutral-500">
              {todoistReady ? "Dùng TODOIST_API_TOKEN từ biến môi trường." : "Thêm TODOIST_API_TOKEN vào biến môi trường."}
            </p>
          </article>
        </section>

        <section className="space-y-3">
          <SectionTitle>Sắp có</SectionTitle>
          {["Nguồn Google Drive", "Telegram"].map((name) => (
            <article key={name} className={`${CARD} flex items-center justify-between gap-2 p-4`}>
              <h3 className="font-medium">{name}</h3>
              <span className="text-sm text-neutral-500">Sắp có</span>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

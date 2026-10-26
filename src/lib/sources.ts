import { SYNC_SOURCES, type SyncSource } from "@/db/schema";

export const SOURCE_LABELS: Record<SyncSource, string> = {
  google_calendar: "Google Calendar",
  todoist: "Todoist",
  ftugate: "FTUGate (Cổng sinh viên)",
  drive: "Google Drive",
  telegram: "Telegram",
  webpush: "Thông báo đẩy (Web Push)",
};

/** Env vars each source needs before it counts as configured. */
export const SOURCE_ENV: Record<SyncSource, string[]> = {
  google_calendar: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  drive: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  todoist: ["TODOIST_API_TOKEN"],
  ftugate: [], // scraper runs in GitHub Actions and pushes here; no server-side env
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  webpush: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
};

export const SOURCE_IDS = SYNC_SOURCES;

export function isSyncSource(value: string): value is SyncSource {
  return (SYNC_SOURCES as readonly string[]).includes(value);
}

export function isConfigured(
  source: SyncSource,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return SOURCE_ENV[source].every((k) => !!env[k]);
}

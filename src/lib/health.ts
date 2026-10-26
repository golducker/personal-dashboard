import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { syncRuns, type SyncSource } from "@/db/schema";
import { getConnection } from "./google";
import { SOURCE_IDS, SOURCE_LABELS, isConfigured } from "./sources";

export type HealthStatus = "not_configured" | "not_connected" | "never_synced" | "ok" | "error" | "running";

export type SourceHealth = {
  source: SyncSource;
  label: string;
  configured: boolean;
  status: HealthStatus;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastRunAt: string | null;
};

const GOOGLE_SOURCES: SyncSource[] = ["google_calendar", "drive"];

/** Pure status decision. Google sources need an oauth_tokens row on top of the env vars. */
export function decideStatus(opts: {
  configured: boolean;
  needsConnection: boolean;
  connected: boolean;
  latest: "running" | "success" | "error" | null;
}): HealthStatus {
  const { configured, needsConnection, connected, latest } = opts;
  if (configured && needsConnection && !connected) return "not_connected";
  if (latest) return latest === "success" ? "ok" : latest;
  return configured ? "never_synced" : "not_configured";
}

export async function getSourceHealth(): Promise<SourceHealth[]> {
  const db = await getDb();
  const connected = !!(await getConnection().catch(() => null));
  return Promise.all(
    SOURCE_IDS.map(async (source) => {
      const [latest] = await db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.source, source))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      const [lastOk] = await db
        .select()
        .from(syncRuns)
        .where(and(eq(syncRuns.source, source), eq(syncRuns.status, "success")))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      const configured = isConfigured(source);
      const status = decideStatus({
        configured,
        needsConnection: GOOGLE_SOURCES.includes(source),
        connected,
        latest: latest?.status ?? null,
      });
      return {
        source,
        label: SOURCE_LABELS[source],
        configured,
        status,
        lastSuccessAt: (lastOk?.finishedAt ?? lastOk?.startedAt)?.toISOString() ?? null,
        lastError: latest?.status === "error" ? (latest.error ?? "Lỗi không xác định") : null,
        lastRunAt: latest?.startedAt.toISOString() ?? null,
      };
    }),
  );
}

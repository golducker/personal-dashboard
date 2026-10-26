import { HardDrives } from "@phosphor-icons/react/dist/ssr";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines, files, sources } from "@/db/schema";
import { readConfig } from "@/lib/drive/config";
import { Panel } from "./card";
import { AddDriveSource, DriveSourceItem, type SourceView } from "./drive-source-controls";

const KIND_LABELS: Record<string, string> = {
  folder: "Thư mục",
  shared_drive: "Shared drive",
  file: "File",
  sheet: "Sheet",
};

async function loadSources(): Promise<SourceView[]> {
  const db = await getDb();
  const rows = await db.select().from(sources).orderBy(sources.createdAt);
  return Promise.all(
    rows.map(async (s) => {
      const [f] = await db.select({ n: count() }).from(files).where(eq(files.sourceId, s.id));
      const [d] = await db.select({ n: count() }).from(deadlines).where(eq(deadlines.sourceId, s.id));
      const config = readConfig(s.config);
      return {
        id: s.id,
        label: s.label,
        kind: KIND_LABELS[s.kind] ?? s.kind,
        profile: s.profile,
        parser: config?.parser ?? "none",
        configJson: config ? JSON.stringify(config, null, 2) : "",
        files: f?.n ?? 0,
        deadlines: d?.n ?? 0,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
      };
    }),
  );
}

export async function DriveSourcesPanel() {
  const list = await loadSources();
  return (
    <Panel title="Nguồn Drive" icon={<HardDrives />} meta={list.length ? `${list.length} nguồn` : undefined}>
      <div className="space-y-4">
        {list.length > 0 && (
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <DriveSourceItem key={s.id} source={s} />
            ))}
          </ul>
        )}
        <AddDriveSource />
      </div>
    </Panel>
  );
}

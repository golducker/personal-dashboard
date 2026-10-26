import { loadEnv } from "./load-env";
loadEnv();

async function main() {
  const { getDb } = await import("../src/db");
  const { syncRuns } = await import("../src/db/schema");
  const db = await getDb();
  const ago = (min: number) => new Date(Date.now() - min * 60_000);

  await db.insert(syncRuns).values([
    {
      source: "todoist",
      startedAt: ago(125),
      finishedAt: ago(124),
      status: "success",
      itemsCount: 42,
    },
    {
      source: "google_calendar",
      startedAt: ago(30),
      finishedAt: ago(29),
      status: "success",
      itemsCount: 17,
    },
    {
      source: "ftugate",
      startedAt: ago(10),
      finishedAt: ago(9),
      status: "error",
      itemsCount: 0,
      error: "Đăng nhập FTUGate thất bại: sai tên đăng nhập hoặc mật khẩu.",
    },
    { source: "drive", startedAt: ago(1), status: "running", itemsCount: 0 },
  ]);
  console.log("Seeded sample sync_runs.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

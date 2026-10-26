import { loadEnv } from "./load-env";
loadEnv();

async function main() {
  const { getDb, usesPostgres } = await import("../src/db");
  const db = await getDb();
  if (usesPostgres()) {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied (Postgres / Neon).");
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied (PGlite at ./.data/pglite).");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

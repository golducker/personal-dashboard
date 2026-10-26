import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const PGLITE_DIR = "./.data/pglite";

export function usesPostgres(): boolean {
  return !!process.env.DATABASE_URL?.startsWith("postgres");
}

const g = globalThis as unknown as { __dashboardPromise?: Promise<Db> };

async function create(): Promise<Db> {
  if (usesPostgres()) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(process.env.DATABASE_URL!), { schema }) as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  mkdirSync(".data", { recursive: true });
  return drizzle(new PGlite(PGLITE_DIR), { schema }) as unknown as Db;
}

/**
 * Lazily created (importing this module never opens a connection, e.g. at build time).
 * Driver: Neon HTTP when DATABASE_URL starts with "postgres", otherwise PGlite at ./.data/pglite.
 */
export function getDb(): Promise<Db> {
  if (!g.__dashboardPromise) g.__dashboardPromise = create();
  return g.__dashboardPromise;
}

export { schema };

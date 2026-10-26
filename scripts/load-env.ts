/** Load .env.local / .env into process.env for CLI scripts (Next does this itself for the app). */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file missing: ignore
    }
  }
}

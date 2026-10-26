/**
 * FTUgate scraper (runs on GitHub Actions, not Vercel).
 *
 * Drives the real FTUgate SPA in headless Chromium and captures the JSON the page itself
 * requests. It never calls the API directly: FTUgate signs each request in its own JS and we
 * leave that alone. Captured data is POSTed to the dashboard's /api/sync/ftugate.
 *
 * The repo is public, so Actions logs are public: never log payloads, credentials or URLs
 * with tokens. Only kinds, counts, HTTP statuses and error codes.
 *
 * Usage: tsx scripts/ftugate/scrape.ts [--kinds=grades,schedule,exams,notices] [--dry-run]
 *   --dry-run writes captured payloads to .data/ftugate-sample/ (gitignored) instead of POSTing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, errors, type Page } from "playwright";
import { loadEnv } from "../load-env";

loadEnv();

const LOGIN_URL = "https://ftugate.ftu.edu.vn/#/";
const NAV_TIMEOUT = 45_000;
const DATA_TIMEOUT = 30_000;

type Kind = "schedule" | "exams" | "grades" | "notices";
type ErrorCode = "login_failed" | "captcha" | "timeout" | "bad_response" | "unknown";

/** Each kind: SPA routes to open and, per route, payload key → API endpoint path to wait for. */
const KINDS: Record<Kind, { route: string; wait: Record<string, string> }[]> = {
  schedule: [
    {
      route: "#/tkb-tuan",
      wait: { semesters: "sch/w-locdshockytkbuser", week: "sch/w-locdstkbtuanusertheohocky" },
    },
    { route: "#/tkb-hocky", wait: { term: "sch/w-locdstkbhockytheodoituong" } },
  ],
  exams: [
    {
      route: "#/lichthi",
      wait: { semesters: "report/w-locdshockylichthisinhvien", exams: "epm/w-locdslichthisvtheohocky" },
    },
  ],
  grades: [{ route: "#/diem", wait: { grades: "srm/w-locdsdiemsinhvien" } }],
  // there is no notices route (#/thongbao → #/error); the home page loads them
  notices: [{ route: "#/home", wait: { notices: "web/w-locdsthongbao" } }],
};
const ALL_KINDS = Object.keys(KINDS) as Kind[];

class ScrapeError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

function log(msg: string) {
  console.log(`[ftugate] ${msg}`);
}

function parseArgs(argv: string[]) {
  const kindsArg = argv.find((a) => a.startsWith("--kinds="))?.slice("--kinds=".length);
  const kinds = kindsArg ? kindsArg.split(",").map((k) => k.trim()).filter(Boolean) : ALL_KINDS;
  for (const k of kinds) {
    if (!(ALL_KINDS as string[]).includes(k)) throw new Error(`Unknown kind: ${k}`);
  }
  return { kinds: kinds as Kind[], dryRun: argv.includes("--dry-run") };
}

/** Endpoint path ("sch/w-…") of an FTUgate API URL, or null for anything else. */
function endpointOf(url: string): string | null {
  const m = /\/api\/([^?#]+)/.exec(url);
  return m ? m[1] : null;
}

/** Collects the `data` field of every API response the page receives, keyed by endpoint path. */
function collect(page: Page) {
  const seen = new Map<string, unknown>();
  const bad = new Set<string>();
  page.on("response", async (res) => {
    const endpoint = endpointOf(res.url());
    if (!endpoint || res.request().method() !== "POST") return;
    try {
      const json = (await res.json()) as { data?: unknown; result?: unknown };
      if (!res.ok() || json?.data === undefined || json.result === false) {
        bad.add(endpoint);
      } else {
        bad.delete(endpoint);
        seen.set(endpoint, json.data);
      }
    } catch {
      bad.add(endpoint);
    }
  });
  return { seen, bad };
}

async function login(page: Page, username: string, password: string) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  const user = page.locator('input[formcontrolname="username"]');
  await user.waitFor({ timeout: NAV_TIMEOUT });
  await user.fill(username);
  await page.locator('input[formcontrolname="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(/\/cq\/hanoi\//, { timeout: NAV_TIMEOUT });
  } catch {
    const captcha = await page
      .locator('img[src*="captcha" i], [class*="captcha" i], iframe[src*="recaptcha"], [formcontrolname*="captcha" i]')
      .count();
    throw new ScrapeError(captcha > 0 ? "captcha" : "login_failed");
  }
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT }).catch(() => {});
}

/** Opens one SPA route and waits until every endpoint it needs has answered. */
async function openRoute(
  page: Page,
  state: ReturnType<typeof collect>,
  route: string,
  wait: Record<string, string>,
): Promise<Record<string, unknown>> {
  const endpoints = Object.values(wait);
  for (const e of endpoints) state.seen.delete(e);
  if (new URL(page.url()).hash === route) {
    // setting the same hash is a no-op, so reload to make the page request its data again
    await page.reload({ waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  } else {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, route);
  }

  const deadline = Date.now() + DATA_TIMEOUT;
  while (Date.now() < deadline) {
    if (endpoints.every((e) => state.seen.has(e))) break;
    if (endpoints.some((e) => state.bad.has(e))) throw new ScrapeError("bad_response");
    await page.waitForTimeout(250);
  }
  const missing = endpoints.filter((e) => !state.seen.has(e));
  if (missing.length) throw new ScrapeError("timeout");

  return Object.fromEntries(Object.entries(wait).map(([key, e]) => [key, state.seen.get(e)]));
}

async function scrapeKind(page: Page, state: ReturnType<typeof collect>, kind: Kind) {
  const payload: Record<string, unknown> = {};
  for (const { route, wait } of KINDS[kind]) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // bounce via home so a retry (or a repeated route) really re-requests its data
        if (attempt > 0) {
          await page.evaluate(() => {
            location.hash = "#/home";
          });
          await page.waitForTimeout(1500);
        }
        Object.assign(payload, await openRoute(page, state, route, wait));
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) throw lastError;
  }
  return payload;
}

function errorCode(e: unknown): ErrorCode {
  if (e instanceof ScrapeError) return e.code;
  if (e instanceof errors.TimeoutError) return "timeout";
  return "unknown";
}

async function post(body: unknown): Promise<Record<string, unknown>> {
  const base = process.env.DASHBOARD_URL?.replace(/\/+$/, "");
  const secret = process.env.SYNC_SECRET;
  if (!base || !secret) throw new Error("DASHBOARD_URL and SYNC_SECRET are required");
  const res = await fetch(`${base}/api/sync/ftugate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  log(`dashboard responded ${res.status}`);
  if (!res.ok) throw new Error(`dashboard returned ${res.status}`);
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function main() {
  const { kinds, dryRun } = parseArgs(process.argv.slice(2));
  const username = process.env.FTU_USERNAME;
  const password = process.env.FTU_PASSWORD;
  if (!username || !password) throw new Error("FTU_USERNAME and FTU_PASSWORD are required");

  log(`kinds: ${kinds.join(", ")}${dryRun ? " (dry run)" : ""}`);
  const browser = await chromium.launch();
  const snapshots: { kind: Kind; payload: Record<string, unknown> }[] = [];
  let failure: ErrorCode | null = null;
  try {
    const page = await browser.newPage();
    const state = collect(page);
    await login(page, username, password);
    log("login ok");
    for (const kind of kinds) {
      try {
        snapshots.push({ kind, payload: await scrapeKind(page, state, kind) });
        log(`${kind}: captured`);
      } catch (e) {
        failure ??= errorCode(e);
        log(`${kind}: failed (${errorCode(e)})`);
      }
    }
  } catch (e) {
    failure = errorCode(e);
    log(`failed (${failure})`);
  } finally {
    await browser.close();
  }

  if (dryRun) {
    const dir = ".data/ftugate-sample";
    mkdirSync(dir, { recursive: true });
    for (const s of snapshots) writeFileSync(`${dir}/${s.kind}.json`, JSON.stringify(s.payload, null, 2));
    log(`wrote ${snapshots.length} file(s) to ${dir}`);
  } else {
    if (snapshots.length) {
      const r = await post({ snapshots });
      const list = (v: unknown) => (Array.isArray(v) ? v.join(",") || "-" : "-");
      log(`stored: ${list(r.stored)}; unchanged: ${list(r.unchanged)}; new grades: ${r.newGrades ?? 0}; notified: ${r.notified ?? 0}`);
    }
    if (failure) await post({ error: failure });
  }
  if (failure) process.exitCode = 1;
}

main().catch((e) => {
  // message only: never a stack with page content, never the error's data
  log(`fatal: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exitCode = 1;
});

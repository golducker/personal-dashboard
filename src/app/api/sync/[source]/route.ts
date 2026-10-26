import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { syncRuns } from "@/db/schema";
import { checkBearer } from "@/lib/auth";
import { runDriveSync } from "@/lib/drive/sync";
import { MAX_BODY_BYTES, ftugateBodySchema, handleFtugate } from "@/lib/ftugate/sync";
import { isSyncSource } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Stub endpoint: GitHub Actions / cron call this to report (and later perform) a sync.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ source: string }> },
) {
  if (!checkBearer(request.headers.get("authorization"), process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await ctx.params;
  if (!isSyncSource(source)) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 404 });
  }

  if (source === "ftugate") {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = ftugateBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { status, result } = await handleFtugate(parsed.data);
    return NextResponse.json(result, { status });
  }

  if (source === "drive") {
    try {
      const { status, result } = await runDriveSync();
      return NextResponse.json(result, { status });
    } catch {
      return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
    }
  }

  let count = 0;
  try {
    const body = await request.json();
    if (typeof body?.count === "number" && Number.isFinite(body.count) && body.count >= 0) {
      count = Math.floor(body.count);
    }
  } catch {
    // empty or non-JSON body: count stays 0
  }

  const now = new Date();
  const db = await getDb();
  const [run] = await db
    .insert(syncRuns)
    .values({ source, startedAt: now, finishedAt: now, status: "success", itemsCount: count })
    .returning({ id: syncRuns.id });

  return NextResponse.json({ ok: true, id: run.id, source, status: "success", items: count });
}

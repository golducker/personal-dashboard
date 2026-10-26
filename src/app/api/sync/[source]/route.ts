import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { syncRuns } from "@/db/schema";
import { checkBearer } from "@/lib/auth";
import { isSyncSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

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

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { queueOrRun } from "@/lib/todoist-offline";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const r = await queueOrRun("close", (await ctx.params).id);
    return r.queued ? NextResponse.json({ queued: true }, { status: 202 }) : NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

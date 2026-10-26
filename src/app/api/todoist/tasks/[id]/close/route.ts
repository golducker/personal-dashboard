import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { closeTask } from "@/lib/todoist";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await closeTask((await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

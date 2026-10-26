import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { runDriveSync } from "@/lib/drive/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manual "Sync ngay" for one source. Authenticated by the session cookie (see src/proxy.ts).
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { status, result } = await runDriveSync({ onlySourceId: id });
    return NextResponse.json(result, { status });
  } catch (e) {
    return apiError(e);
  }
}

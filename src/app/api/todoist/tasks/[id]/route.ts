import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { queueOrRun } from "@/lib/todoist-offline";

export const dynamic = "force-dynamic";

const patchBody = z.object({
  content: z.string().trim().min(1).max(500).optional(),
  due_string: z.string().trim().max(100).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  description: z.string().max(8000).optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await queueOrRun("update", id, patchBody.parse(await request.json()));
    return r.queued ? NextResponse.json(r, { status: 202 }) : NextResponse.json({ task: r.task });
  } catch (e) {
    return apiError(e);
  }
}

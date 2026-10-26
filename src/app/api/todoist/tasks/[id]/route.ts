import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { updateTask } from "@/lib/todoist";

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
    return NextResponse.json({ task: await updateTask(id, patchBody.parse(await request.json())) });
  } catch (e) {
    return apiError(e);
  }
}

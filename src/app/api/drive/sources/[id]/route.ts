import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines, files, sources } from "@/db/schema";
import { apiError } from "@/lib/api";
import { updateSourceSchema } from "@/lib/drive/sources";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = updateSourceSchema.parse(await request.json());
    const db = await getDb();
    const [row] = await db.select({ id: sources.id }).from(sources).where(eq(sources.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: "Không tìm thấy nguồn.", code: "not_found" }, { status: 404 });

    const set: Partial<typeof sources.$inferInsert> = {};
    if (body.label !== undefined) set.label = body.label;
    if (body.profile !== undefined) set.profile = body.profile;
    if (body.config !== undefined) {
      set.config = body.config;
      set.extractDeadlines = body.config !== null;
    }
    if (Object.keys(set).length > 0) await db.update(sources).set(set).where(eq(sources.id, id));

    if (body.config !== undefined) {
      // parser settings changed: parse every sheet again on the next sync
      await db.update(files).set({ contentHash: null }).where(eq(files.sourceId, id));
      if (body.config === null) {
        await db.delete(deadlines).where(and(eq(deadlines.sourceId, id), eq(deadlines.manualOverride, false)));
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    await db.delete(sources).where(eq(sources.id, id)); // files, projects, deadlines cascade
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

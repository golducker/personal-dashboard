import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dailyItems, dailyLog } from "@/db/schema";
import { apiError } from "@/lib/api";
import { dayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ error: "Không tìm thấy mục.", code: "not_found" }, { status: 404 });
const body = z.object({ done: z.boolean() });

/** Ticks/unticks the item for today. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { done } = body.parse(await request.json());
    if (!UUID.test(id)) return notFound();
    const db = await getDb();
    const [row] = await db.select({ id: dailyItems.id }).from(dailyItems).where(eq(dailyItems.id, id)).limit(1);
    if (!row) return notFound();
    const day = dayKey(new Date());
    if (done) await db.insert(dailyLog).values({ itemId: id, day }).onConflictDoNothing();
    else await db.delete(dailyLog).where(and(eq(dailyLog.itemId, id), eq(dailyLog.day, day)));
    return NextResponse.json({ id, done });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return notFound();
    const db = await getDb();
    await db.delete(dailyItems).where(eq(dailyItems.id, id));
    return NextResponse.json({ id });
  } catch (e) {
    return apiError(e);
  }
}

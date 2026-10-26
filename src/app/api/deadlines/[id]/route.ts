import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deadlines } from "@/db/schema";
import { apiError } from "@/lib/api";
import { readProgress, updateProgressSchema } from "@/lib/drive/progress";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ error: "Không tìm thấy deadline.", code: "not_found" }, { status: 404 });

/** Sets (or, with null, resets to the sheet) the user's own progress on a deadline. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { progress } = updateProgressSchema.parse(await request.json());
    if (!UUID.test(id)) return notFound(); // a malformed id would make Postgres throw
    const db = await getDb();
    const [row] = await db.select({ progress: deadlines.progress }).from(deadlines).where(eq(deadlines.id, id)).limit(1);
    if (!row) return notFound();

    await db.update(deadlines).set({ progress, progressUpdatedAt: new Date() }).where(eq(deadlines.id, id));
    return NextResponse.json({ id, progress, previous: readProgress(row.progress) });
  } catch (e) {
    return apiError(e);
  }
}

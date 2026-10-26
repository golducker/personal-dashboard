import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { apiError } from "@/lib/api";
import { createSourceSchema } from "@/lib/drive/sources";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = createSourceSchema.parse(await request.json());
    const db = await getDb();
    const [dup] = await db.select({ id: sources.id }).from(sources).where(eq(sources.googleId, body.googleId)).limit(1);
    if (dup) return NextResponse.json({ error: "Nguồn này đã được thêm.", code: "duplicate" }, { status: 409 });
    const [row] = await db
      .insert(sources)
      .values({
        googleId: body.googleId,
        kind: body.kind,
        label: body.label,
        profile: body.profile,
        config: body.config,
        extractDeadlines: body.config !== null,
      })
      .returning({ id: sources.id });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return apiError(e);
  }
}

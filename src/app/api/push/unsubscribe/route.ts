import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ endpoint: z.url().max(2048) });

export async function POST(request: Request) {
  try {
    const { endpoint } = bodySchema.parse(await request.json());
    const db = await getDb();
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

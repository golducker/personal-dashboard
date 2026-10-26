import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
});

/** Stores (or refreshes) this device's push subscription, keyed by endpoint. */
export async function POST(request: Request) {
  try {
    const { endpoint, keys } = bodySchema.parse(await request.json());
    const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? null;
    const db = await getDb();
    await db
      .insert(pushSubscriptions)
      .values({ endpoint, keys, userAgent })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { keys, userAgent, failures: 0 } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

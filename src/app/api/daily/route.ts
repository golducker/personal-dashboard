import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { dailyItems } from "@/db/schema";
import { apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const body = z.object({ title: z.string().trim().min(1, "Thiếu nội dung").max(200) });

export async function POST(request: Request) {
  try {
    const { title } = body.parse(await request.json());
    const db = await getDb();
    const [item] = await db.insert(dailyItems).values({ title }).returning({ id: dailyItems.id, title: dailyItems.title });
    return NextResponse.json({ item: { ...item, done: false } }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

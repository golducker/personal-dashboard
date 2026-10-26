import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { extractDriveId } from "@/lib/drive/client";
import { inspectDriveId } from "@/lib/drive/sources";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().min(1).max(500) });

export async function POST(request: Request) {
  try {
    const { url } = bodySchema.parse(await request.json());
    const id = extractDriveId(url);
    if (!id) return NextResponse.json({ error: "Không tìm thấy ID trong link.", code: "invalid" }, { status: 400 });
    return NextResponse.json(await inspectDriveId(id));
  } catch (e) {
    return apiError(e);
  }
}

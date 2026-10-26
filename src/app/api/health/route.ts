import { NextResponse } from "next/server";
import { getSourceHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await getSourceHealth();
  return NextResponse.json({ sources });
}

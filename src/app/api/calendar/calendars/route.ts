import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listCalendars } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ calendars: await listCalendars() });
  } catch (e) {
    return apiError(e);
  }
}

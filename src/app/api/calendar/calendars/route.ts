import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { z } from "zod";
import { HEX_COLOR, listCalendars, setCalendarColor } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ calendars: await listCalendars() });
  } catch (e) {
    return apiError(e);
  }
}

const colorSchema = z.object({ id: z.string().min(1).max(300), color: z.string().regex(HEX_COLOR) });

export async function PATCH(request: Request) {
  try {
    const { id, color } = colorSchema.parse(await request.json());
    await setCalendarColor(id, color);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

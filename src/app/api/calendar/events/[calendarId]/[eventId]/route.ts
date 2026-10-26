import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteEvent, updateEvent } from "@/lib/calendar";
import { patchEventSchema } from "@/lib/calendar-schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ calendarId: string; eventId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { calendarId, eventId } = await ctx.params;
    const patch = patchEventSchema.parse(await request.json());
    return NextResponse.json({ event: await updateEvent(calendarId, eventId, patch) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { calendarId, eventId } = await ctx.params;
    await deleteEvent(calendarId, eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

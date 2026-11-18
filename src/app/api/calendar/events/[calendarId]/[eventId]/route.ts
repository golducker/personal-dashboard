import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteEvent, moveEvent, updateEvent } from "@/lib/calendar";
import { patchEventSchema } from "@/lib/calendar-schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ calendarId: string; eventId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { calendarId, eventId } = await ctx.params;
    const { moveTo, ...patch } = patchEventSchema.parse(await request.json());
    const hasEdit = patch.title !== undefined || patch.location !== undefined || patch.description !== undefined || !!patch.times;
    const event = hasEdit ? await updateEvent(calendarId, eventId, patch) : null;
    if (moveTo && moveTo !== calendarId) await moveEvent(calendarId, eventId, moveTo);
    return NextResponse.json({ event, moved: !!moveTo && moveTo !== calendarId });
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

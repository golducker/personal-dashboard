import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { createEvent, listCalendars, listEvents } from "@/lib/calendar";
import { createEventSchema } from "@/lib/calendar-schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const from = p.get("from");
  const to = p.get("to");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(to) <= Date.parse(from)) {
    return NextResponse.json({ error: "Cần tham số from < to (ISO 8601).", code: "invalid" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      events: await listEvents(new Date(from).toISOString(), new Date(to).toISOString()),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const input = createEventSchema.parse(await request.json());
    const event = await createEvent(input, await listCalendars().catch(() => undefined));
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

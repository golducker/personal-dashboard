import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { TASK_CALENDAR_NAME, calendarIdByName, createEvent, taskBlock } from "@/lib/calendar";
import { getTodayAndOverdue, getUpcoming } from "@/lib/todoist";
import { queueOrRun } from "@/lib/todoist-offline";

export const dynamic = "force-dynamic";

const taskBody = z.object({
  content: z.string().trim().min(1, "Thiếu nội dung").max(500),
  due_string: z.string().trim().max(100).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  project_id: z.string().min(1).optional(),
  description: z.string().max(8000).optional(),
  /** "HH:mm": end of the calendar time block. Not sent to Todoist. */
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ kết thúc không hợp lệ").optional(),
});

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view") ?? "today";
  if (view !== "today" && view !== "upcoming") {
    return NextResponse.json({ error: "view phải là today hoặc upcoming.", code: "invalid" }, { status: 400 });
  }
  try {
    const tasks = view === "today" ? await getTodayAndOverdue() : await getUpcoming(7);
    return NextResponse.json({ tasks });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { end_time, ...input } = taskBody.parse(await request.json());
    const r = await queueOrRun("create", null, input);
    // A due with a clock time also becomes a calendar block; a calendar failure must not lose the task.
    const block = r.task?.due ? taskBlock(r.task.due.date, end_time) : null;
    let calendar: { ok: true } | { ok: false; error: string } | null = null;
    if (block) {
      try {
        await createEvent({
          title: input.content,
          allDay: false,
          ...block,
          calendarId: await calendarIdByName(TASK_CALENDAR_NAME),
          description: r.queued ? undefined : r.task!.url,
        });
        calendar = { ok: true };
      } catch (e) {
        calendar = { ok: false, error: e instanceof Error ? e.message : "Lỗi lịch" };
      }
    }
    return r.queued
      ? NextResponse.json({ ...r, calendar }, { status: 202 })
      : NextResponse.json({ task: r.task, calendar }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

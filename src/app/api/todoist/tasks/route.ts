import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createTask, getTodayAndOverdue, getUpcoming } from "@/lib/todoist";

export const dynamic = "force-dynamic";

const taskBody = z.object({
  content: z.string().trim().min(1, "Thiếu nội dung").max(500),
  due_string: z.string().trim().max(100).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  project_id: z.string().min(1).optional(),
  description: z.string().max(8000).optional(),
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
    const task = await createTask(taskBody.parse(await request.json()));
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

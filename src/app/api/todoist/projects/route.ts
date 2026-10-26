import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listProjects } from "@/lib/todoist";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ projects: await listProjects() });
  } catch (e) {
    return apiError(e);
  }
}

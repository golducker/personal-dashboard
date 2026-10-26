import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GoogleApiError, GoogleNotConnectedError } from "./google";
import { TodoistError, TodoistNotConfiguredError } from "./todoist";

/** Maps known failures to JSON responses (Vietnamese messages, stable `code`). */
export function apiError(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ.", code: "invalid", issues: e.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Yêu cầu không hợp lệ.", code: "invalid" }, { status: 400 });
  if (e instanceof GoogleNotConnectedError) {
    return NextResponse.json(
      { error: e.message, code: e.reason === "expired" ? "google_expired" : "google_not_connected" },
      { status: 409 },
    );
  }
  if (e instanceof TodoistNotConfiguredError) {
    return NextResponse.json({ error: e.message, code: "todoist_not_configured" }, { status: 409 });
  }
  if (e instanceof GoogleApiError || e instanceof TodoistError) {
    return NextResponse.json({ error: e.message, code: "upstream_error" }, { status: e.status === 404 ? 404 : 502 });
  }
  return NextResponse.json({ error: "Lỗi máy chủ.", code: "server_error" }, { status: 500 });
}

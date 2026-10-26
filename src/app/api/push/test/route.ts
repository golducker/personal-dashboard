import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { apiError } from "@/lib/api";
import { isPushConfigured, sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: "Máy chủ chưa cấu hình thông báo đẩy (thiếu khóa VAPID).", code: "push_not_configured" },
        { status: 400 },
      );
    }
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(pushSubscriptions);
    if (n === 0) {
      return NextResponse.json(
        { error: "Chưa có thiết bị nào bật thông báo.", code: "no_subscriptions" },
        { status: 400 },
      );
    }
    const result = await sendPush({ title: "Thông báo thử", body: "Thông báo đẩy đang hoạt động.", url: "/", tag: "test" });
    if (result.sent === 0) {
      return NextResponse.json(
        { error: "Không gửi được thông báo tới thiết bị nào. Thử tắt rồi bật lại.", code: "push_failed", ...result },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiError(e);
  }
}

import webpush from "web-push";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushResult = { sent: number; removed: number; failed: number };

const FALLBACK_SUBJECT = "mailto:admin@example.com";

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function vapid() {
  return {
    subject: process.env.VAPID_SUBJECT || FALLBACK_SUBJECT,
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
}

function readKeys(raw: unknown): { p256dh: string; auth: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { p256dh, auth } = raw as Record<string, unknown>;
  return typeof p256dh === "string" && typeof auth === "string" ? { p256dh, auth } : null;
}

/**
 * Sends one notification to every stored subscription in parallel.
 * 404/410 remove the subscription; other errors bump `failures`. Never logs endpoints, keys or payload.
 */
export async function sendPush(payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  if (!isPushConfigured()) return result;
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return result;

  const { subject, publicKey, privateKey } = vapid();
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24 };
  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/", tag: payload.tag });

  await Promise.all(
    subs.map(async (sub) => {
      const keys = readKeys(sub.keys);
      if (!keys) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
        result.removed++;
        return;
      }
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys }, body, options);
        result.sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastOkAt: new Date(), failures: 0 })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          result.removed++;
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
        } else {
          result.failed++;
          await db
            .update(pushSubscriptions)
            .set({ failures: sql`${pushSubscriptions.failures} + 1` })
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {});
        }
      }
    }),
  );
  return result;
}

/** Fire-and-forget wrapper for alert call sites: a push failure must never break the caller. */
export async function sendPushSafe(payload: PushPayload): Promise<void> {
  try {
    await sendPush(payload);
  } catch {
    /* ignore */
  }
}

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { extractDays } from "./drive/dates";
import { getConnection, googleFetch } from "./google";
import { recordRun } from "./run-log";
import { TZ, dayKey } from "./time";
import { createTask } from "./todoist";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SEEN_KEY = "gmail_seen";
const SEEN_CAP = 2000;

// The rules: starred or deadline-ish subject -> Todoist task; mail carrying an .ics invite -> Calendar event.
// newer_than keeps the first run from dumping old mail; seen ids stop repeats inside the window.
export const TASK_QUERY =
  'in:inbox newer_than:3d (is:starred OR subject:(deadline OR "hạn nộp" OR "hạn chót" OR "nhắc nhở" OR "due"))';
export const INVITE_QUERY = "newer_than:3d filename:ics";

type GTime = { date: string } | { dateTime: string; timeZone?: string };
export type IcsEvent = { uid: string; title: string; start: GTime; end: GTime; location?: string; description?: string };

type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string };
  parts?: Part[];
};
type Message = { id: string; payload?: Part };

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

function icsTime(params: string, value: string): GTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { date };
  const dateTime = `${date}T${m[4]}:${m[5]}:${m[6]}`;
  if (m[7]) return { dateTime: `${dateTime}Z` };
  const tzid = /TZID="?([^;:"]+)/.exec(params)?.[1];
  // shortcut: Windows TZIDs from Outlook ("SE Asia Standard Time") fall back to Vietnam time; map them if mail from other zones matters.
  return { dateTime, timeZone: tzid?.includes("/") ? tzid : TZ };
}

/** First VEVENT of an iCalendar file; null for cancellations or anything unreadable. */
export function parseIcs(text: string): IcsEvent | null {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  if (lines.some((l) => /^METHOD:CANCEL/i.test(l))) return null;
  const props: Record<string, { params: string; value: string }> = {};
  let inEvent = false;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) inEvent = true;
    else if (inEvent && /^(BEGIN|END):/i.test(line)) break; // END:VEVENT or a nested VALARM
    else if (inEvent) {
      const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (m && !props[m[1].toUpperCase()]) props[m[1].toUpperCase()] = { params: m[2], value: m[3] };
    }
  }
  const { UID, SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, STATUS } = props;
  if (!UID || !DTSTART || STATUS?.value === "CANCELLED") return null;
  const start = icsTime(DTSTART.params, DTSTART.value);
  if (!start) return null;
  // No DTEND: all-day lasts one day (exclusive end), timed events get zero length.
  const end = (DTEND && icsTime(DTEND.params, DTEND.value)) || ("date" in start ? { date: nextDay(start.date) } : start);
  return {
    uid: UID.value,
    title: unescape(SUMMARY?.value ?? "").trim() || "(Không tiêu đề)",
    start,
    end,
    location: LOCATION ? unescape(LOCATION.value) : undefined,
    description: DESCRIPTION ? unescape(DESCRIPTION.value) : undefined,
  };
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** First date in the subject that is today or later, as "dd/mm/yyyy" for Todoist (via viDueToEnglish). */
export function dueFromSubject(subject: string, now: Date = new Date()): string | undefined {
  const today = dayKey(now);
  const day = extractDays(subject, Number(today.slice(0, 4))).find((d) => d.day >= today)?.day;
  return day ? day.split("-").reverse().join("/") : undefined;
}

const header = (p: Part | undefined, name: string) =>
  p?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
const mailLink = (id: string) => `https://mail.google.com/mail/u/0/#all/${id}`;
const decode = (b64url: string) => Buffer.from(b64url, "base64url").toString("utf8");

function findIcsPart(p: Part | undefined): Part | null {
  if (!p) return null;
  if (p.mimeType === "text/calendar" || p.filename?.toLowerCase().endsWith(".ics")) return p;
  for (const c of p.parts ?? []) {
    const hit = findIcsPart(c);
    if (hit) return hit;
  }
  return null;
}

async function listIds(q: string): Promise<string[]> {
  const data = await googleFetch<{ messages?: { id: string }[] }>(`${GMAIL}/messages?${new URLSearchParams({ q, maxResults: "50" })}`);
  return (data?.messages ?? []).map((m) => m.id);
}

async function getMessage(id: string, format: "full" | "metadata"): Promise<Message> {
  const qs = format === "metadata" ? "format=metadata&metadataHeaders=Subject&metadataHeaders=From" : "format=full";
  return (await googleFetch<Message>(`${GMAIL}/messages/${id}?${qs}`))!;
}

async function mailToTask(id: string): Promise<void> {
  const msg = await getMessage(id, "metadata");
  const subject = header(msg.payload, "subject").trim() || "(Không tiêu đề)";
  await createTask({
    content: `📧 ${subject}`,
    description: `Từ: ${header(msg.payload, "from")}\n${mailLink(id)}`,
    due_string: dueFromSubject(subject),
  });
}

async function mailToEvent(id: string): Promise<boolean> {
  const msg = await getMessage(id, "full");
  const part = findIcsPart(msg.payload);
  if (!part) return false;
  const raw = part.body?.data
    ? part.body.data
    : part.body?.attachmentId
      ? (await googleFetch<{ data: string }>(`${GMAIL}/messages/${id}/attachments/${part.body.attachmentId}`))!.data
      : "";
  const ev = raw ? parseIcs(decode(raw)) : null;
  if (!ev) return false;
  // Google invites already sit in the calendar; import only what is not there yet.
  const existing = await googleFetch<{ items?: unknown[] }>(`${CALENDAR}?${new URLSearchParams({ iCalUID: ev.uid })}`);
  if (existing?.items?.length) return false;
  await googleFetch(`${CALENDAR}/import`, {
    method: "POST",
    body: JSON.stringify({
      iCalUID: ev.uid,
      summary: ev.title,
      start: ev.start,
      end: ev.end,
      location: ev.location,
      description: [ev.description, mailLink(id)].filter(Boolean).join("\n\n"),
    }),
  });
  return true;
}

export type GmailSyncResult = { ok: boolean; skipped?: string; tasks: number; events: number; failed: number };

export async function runGmailSync(): Promise<GmailSyncResult> {
  const conn = await getConnection();
  if (!conn?.scopes.includes(GMAIL_SCOPE)) return { ok: true, skipped: "gmail_not_connected", tasks: 0, events: 0, failed: 0 };

  return recordRun(
    "gmail",
    async () => {
      const db = await getDb();
      const [row] = await db.select().from(settings).where(eq(settings.key, SEEN_KEY)).limit(1);
      const seen = new Set<string>(Array.isArray(row?.value) ? (row.value as string[]) : []);
      const result: GmailSyncResult = { ok: true, tasks: 0, events: 0, failed: 0 };

      const jobs: Array<[string, () => Promise<unknown>]> = [];
      if (process.env.TODOIST_API_TOKEN) {
        for (const id of await listIds(TASK_QUERY)) jobs.push([`t:${id}`, () => mailToTask(id).then(() => result.tasks++)]);
      }
      for (const id of await listIds(INVITE_QUERY)) jobs.push([`c:${id}`, async () => (await mailToEvent(id)) && result.events++]);

      for (const [key, job] of jobs) {
        if (seen.has(key)) continue;
        try {
          await job();
          seen.add(key);
        } catch {
          result.failed++; // not marked seen: retried next run
        }
      }

      const value = [...seen].slice(-SEEN_CAP);
      await db.insert(settings).values({ key: SEEN_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
      result.ok = result.failed === 0;
      return result;
    },
    (r) => r.tasks + r.events,
  );
}

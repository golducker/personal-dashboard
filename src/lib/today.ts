import { GoogleNotConnectedError } from "./google";
import { TodoistNotConfiguredError } from "./todoist";
import { dayKey, timeLabel } from "./time";
import type { CalEvent } from "./calendar";
import type { TodoTask } from "./todoist";
import { addDays } from "./time";

/** Each home-screen section loads independently and degrades on its own. */
export type Loaded<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "not_connected" | "expired" | "not_configured" | "error"; message: string };

export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof GoogleNotConnectedError) {
      return { ok: false, kind: e.reason === "expired" ? "expired" : "not_connected", message: e.message };
    }
    if (e instanceof TodoistNotConfiguredError) return { ok: false, kind: "not_configured", message: e.message };
    return { ok: false, kind: "error", message: e instanceof Error ? e.message : "Lỗi không xác định" };
  }
}

/** Serializable event shape for client components (times pre-formatted in Asia/Ho_Chi_Minh). */
export type EventView = {
  id: string;
  calendarId: string;
  calendarName: string;
  color: string;
  title: string;
  location: string | null;
  htmlLink: string | null;
  allDay: boolean;
  when: string;
  date: string;
  startTime: string;
  endTime: string;
};

export function toEventView(e: CalEvent): EventView {
  if (e.allDay) {
    return {
      id: e.id, calendarId: e.calendarId, calendarName: e.calendarName, color: e.color, title: e.title,
      location: e.location, htmlLink: e.htmlLink, allDay: true, when: "Cả ngày",
      date: e.start, startTime: "09:00", endTime: "10:00",
    };
  }
  const startTime = timeLabel(e.start);
  const endTime = timeLabel(e.end);
  return {
    id: e.id, calendarId: e.calendarId, calendarName: e.calendarName, color: e.color, title: e.title,
    location: e.location, htmlLink: e.htmlLink, allDay: false, when: `${startTime} - ${endTime}`,
    date: dayKey(e.start), startTime, endTime,
  };
}

export type TaskView = {
  id: string;
  content: string;
  priority: 1 | 2 | 3 | 4;
  projectName: string | null;
  dueLabel: string;
};

/** Due time label: "HH:mm" for timed due dates, "" for date-only. */
export function dueTimeLabel(date: string): string {
  if (date.length <= 10) return "";
  return /Z|[+-]\d\d:\d\d$/.test(date) ? timeLabel(date) : date.slice(11, 16);
}

export function toTaskView(t: TodoTask, projects: Map<string, string>, today: string): TaskView {
  const day = t.due?.date.slice(0, 10) ?? "";
  const time = t.due ? dueTimeLabel(t.due.date) : "";
  let dueLabel = "";
  if (day && day < today) dueLabel = t.due!.string || day.split("-").reverse().join("/");
  else if (day === today) dueLabel = time;
  else if (day) dueLabel = `${day === addDays(today, 1) ? "Mai" : day.slice(8) + "/" + day.slice(5, 7)}${time ? " " + time : ""}`;
  return {
    id: t.id,
    content: t.content,
    priority: t.priority,
    projectName: projects.get(t.projectId) ?? null,
    dueLabel,
  };
}

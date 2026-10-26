import { recordRun } from "./run-log";
import { addDays, dayKey } from "./time";
import { viDueToEnglish } from "./vi-due";

const BASE = "https://api.todoist.com/api/v1";

export class TodoistNotConfiguredError extends Error {
  skipLog = true;
  constructor() {
    super("Chưa cấu hình TODOIST_API_TOKEN");
    this.name = "TodoistNotConfiguredError";
  }
}

export class TodoistError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "TodoistError";
  }
}

export type TodoTask = {
  id: string;
  content: string;
  description: string;
  projectId: string;
  /** Todoist API scale: 4 = urgent (p1 in the app) ... 1 = normal. */
  priority: 1 | 2 | 3 | 4;
  /** date is "YYYY-MM-DD" or a datetime string as returned by Todoist. */
  due: { date: string; string: string; recurring: boolean } | null;
  labels: string[];
  url: string;
};
export type TodoProject = { id: string; name: string; color: string; inbox: boolean };

type RawTask = {
  id: string;
  content?: string;
  description?: string;
  project_id?: string;
  priority?: number;
  due?: { date?: string; string?: string; is_recurring?: boolean } | null;
  labels?: string[];
};
type RawProject = { id: string; name?: string; color?: string; inbox_project?: boolean };
type Page<T> = { results?: T[]; next_cursor?: string | null };

export function mapTask(t: RawTask): TodoTask {
  const p = t.priority ?? 1;
  return {
    id: t.id,
    content: t.content ?? "",
    description: t.description ?? "",
    projectId: t.project_id ?? "",
    priority: (p >= 1 && p <= 4 ? p : 1) as TodoTask["priority"],
    due: t.due?.date ? { date: t.due.date, string: t.due.string ?? t.due.date, recurring: !!t.due.is_recurring } : null,
    labels: t.labels ?? [],
    url: `https://app.todoist.com/app/task/${t.id}`,
  };
}

export function mapProject(p: RawProject): TodoProject {
  return { id: p.id, name: p.name ?? "", color: p.color ?? "grey", inbox: !!p.inbox_project };
}

/** Follows `next_cursor` until exhausted (or maxPages) and concatenates `results`. */
export async function collectPages<T>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    out.push(...(page.results ?? []));
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return out;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) throw new TodoistNotConfiguredError();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
    cache: "no-store",
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new TodoistError(res.status, text.slice(0, 200) || `Todoist lỗi ${res.status}`);
  return text ? (JSON.parse(text) as T) : null;
}

const paged = <T>(path: string, params: Record<string, string> = {}) =>
  collectPages<T>(async (cursor) => {
    const qs = new URLSearchParams({ limit: "200", ...params, ...(cursor ? { cursor } : {}) });
    return (await request<Page<T>>(`${path}?${qs}`)) ?? {};
  });

async function byFilter(query: string): Promise<TodoTask[]> {
  return (await paged<RawTask>("/tasks/filter", { query, lang: "en" })).map(mapTask);
}

export function getTodayAndOverdue(): Promise<TodoTask[]> {
  return recordRun("todoist", () => byFilter("today | overdue"));
}

/** Tasks due in the next `days` days (includes today; callers may trim). */
export function getUpcoming(days = 7): Promise<TodoTask[]> {
  return recordRun("todoist", () => byFilter(`${days} days`));
}

export async function listProjects(): Promise<TodoProject[]> {
  return (await paged<RawProject>("/projects")).map(mapProject);
}

function withDue<T extends { due_string?: string }>(input: T) {
  return input.due_string ? { ...input, due_string: viDueToEnglish(input.due_string), due_lang: "en" } : input;
}

export type NewTask = { content: string; due_string?: string; priority?: number; project_id?: string; description?: string };

export async function createTask(input: NewTask): Promise<TodoTask> {
  const body = withDue(input);
  return mapTask((await request<RawTask>("/tasks", { method: "POST", body: JSON.stringify(body) }))!);
}

export async function updateTask(id: string, input: Partial<NewTask>): Promise<TodoTask> {
  const body = withDue(input);
  return mapTask((await request<RawTask>(`/tasks/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(body) }))!);
}

export async function closeTask(id: string): Promise<void> {
  await request(`/tasks/${encodeURIComponent(id)}/close`, { method: "POST" });
}

export async function reopenTask(id: string): Promise<void> {
  await request(`/tasks/${encodeURIComponent(id)}/reopen`, { method: "POST" });
}

/** Splits tasks into overdue / due today (by Asia/Ho_Chi_Minh date) / next 7 days. */
export function splitByDue(tasks: TodoTask[], now: Date = new Date()) {
  const today = dayKey(now);
  const dateOf = (t: TodoTask) => t.due?.date.slice(0, 10) ?? "";
  const byPriority = (a: TodoTask, b: TodoTask) => b.priority - a.priority || a.due!.date.localeCompare(b.due!.date);
  const dated = tasks.filter((t) => t.due);
  return {
    overdue: dated.filter((t) => dateOf(t) < today).sort(byPriority),
    today: dated.filter((t) => dateOf(t) === today).sort(byPriority),
    later: dated.filter((t) => dateOf(t) > today && dateOf(t) <= addDays(today, 7)).sort(byPriority),
  };
}

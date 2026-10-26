// Turns stored FTUgate snapshots into what the dashboard cards show.
// Field names of the eduSoft payloads live here (grades: ./grades.ts).

export type ClassView = {
  start: string; // "HH:mm"
  end: string;
  code: string;
  name: string;
  room: string | null;
  teacher: string | null;
};

export type DayView = { day: string; weekday: string; isToday: boolean; classes: ClassView[] };

export type WeekView = {
  /** 1-based week of the semester, from FTUgate. */
  semesterWeek: number | null;
  range: string; // "26/10 - 01/11"
  isCurrent: boolean;
  days: DayView[];
};

export type ExamView = {
  day: string; // YYYY-MM-DD
  time: string | null;
  minutes: number | null;
  code: string;
  name: string;
  room: string | null;
  place: string | null;
  format: string | null;
  daysLeft: number;
};

export type NoticeView = { id: string; title: string; date: string | null; unread: boolean };

type Rec = Record<string, unknown>;

function isRecord(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arr(v: unknown): Rec[] {
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function int(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** "dd/mm/yyyy" or ISO "yyyy-mm-ddT..." → "YYYY-MM-DD". */
export function toDayKey(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (vn) return `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  return null;
}

/** "6:45" → "06:45". */
export function toTime(v: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(str(v) ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** "1HCA0601-Phòng học A601" → "Phòng học A601" (drops the class-group prefix). */
export function roomName(v: unknown): string | null {
  const s = str(v);
  return s ? s.replace(/^[A-Z0-9]+-(?=\D)/, "") : null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function addDay(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Same casing as Intl "vi-VN" (formatLongDate).
const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function weekdayOf(key: string): string {
  return WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
}

function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/**
 * The week containing `today` (or, between semesters, the next week that has classes).
 * Payload: `{ week: { ds_tiet_trong_ngay, ds_tuan_tkb: [{ tuan_hoc_ky, ngay_bat_dau, ds_thoi_khoa_bieu }] } }`.
 */
export function weekView(payload: unknown, today: string): WeekView | null {
  if (!isRecord(payload) || !isRecord(payload.week)) return null;
  const periods = new Map<number, { start: string | null; end: string | null }>();
  for (const p of arr(payload.week.ds_tiet_trong_ngay)) {
    const n = int(p.tiet);
    if (n !== null) periods.set(n, { start: toTime(p.gio_bat_dau), end: toTime(p.gio_ket_thuc) });
  }

  const weeks = arr(payload.week.ds_tuan_tkb)
    .map((w) => ({ w, start: toDayKey(w.ngay_bat_dau), end: toDayKey(w.ngay_ket_thuc) }))
    .filter((x): x is { w: Rec; start: string; end: string } => !!x.start && !!x.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const current = weeks.find((x) => x.start <= today && today <= x.end);
  const pick =
    current ?? weeks.find((x) => x.start > today && arr(x.w.ds_thoi_khoa_bieu).length > 0) ?? null;
  if (!pick) return null;

  const byDay = new Map<string, ClassView[]>();
  for (const c of arr(pick.w.ds_thoi_khoa_bieu)) {
    const day = toDayKey(c.ngay_hoc);
    const first = int(c.tiet_bat_dau);
    const count = int(c.so_tiet) ?? 1;
    if (!day || first === null) continue;
    const list = byDay.get(day) ?? [];
    list.push({
      start: periods.get(first)?.start ?? `Tiết ${first}`,
      end: periods.get(first + count - 1)?.end ?? "",
      code: str(c.ma_mon) ?? "",
      name: str(c.ten_mon) ?? str(c.ma_mon) ?? "",
      room: roomName(c.ma_phong),
      teacher: str(c.ten_giang_vien),
    });
    byDay.set(day, list);
  }

  const days: DayView[] = [];
  for (let d = pick.start; d <= pick.end; d = addDay(d, 1)) {
    const classes = (byDay.get(d) ?? []).sort((a, b) => a.start.localeCompare(b.start));
    days.push({ day: d, weekday: weekdayOf(d), isToday: d === today, classes });
  }
  return {
    semesterWeek: int(pick.w.tuan_hoc_ky),
    range: `${shortDate(pick.start)} - ${shortDate(pick.end)}`,
    isCurrent: pick === current,
    days,
  };
}

/** Exams from today on, soonest first. Payload: `{ exams: { ds_lich_thi: [...] } }`. */
export function examsView(payload: unknown, today: string): ExamView[] {
  if (!isRecord(payload) || !isRecord(payload.exams)) return [];
  return arr(payload.exams.ds_lich_thi)
    .map((e) => {
      const day = toDayKey(e.ngay_thi);
      if (!day) return null;
      return {
        day,
        time: toTime(e.gio_bat_dau),
        minutes: int(e.so_phut),
        code: str(e.ma_mon) ?? "",
        name: str(e.ten_mon) ?? str(e.ma_mon) ?? "",
        room: roomName(e.ma_phong),
        place: str(e.dia_diem_thi),
        format: str(e.hinh_thuc_thi),
        daysLeft: daysBetween(today, day),
      };
    })
    .filter((e): e is ExamView => !!e && e.daysLeft >= 0)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? ""));
}

/** Latest notices. Payload: `{ notices: { ds_thong_bao: [{ id, tieu_de, ngay_gui, is_da_doc }] } }`. */
export function noticesView(payload: unknown, limit = 5): NoticeView[] {
  if (!isRecord(payload) || !isRecord(payload.notices)) return [];
  return arr(payload.notices.ds_thong_bao)
    .map((n, i) => ({
      id: str(n.id) ?? String(i),
      title: str(n.tieu_de) ?? "",
      date: toDayKey(n.ngay_gui),
      unread: n.is_da_doc === false,
    }))
    .filter((n) => n.title)
    .slice(0, limit);
}

export function shortDayLabel(key: string): string {
  return `${weekdayOf(key)}, ${shortDate(key)}`;
}

import { localDateTime } from "@/lib/time";
import { extractDays, parseDue } from "../dates";
import { cell, findCol, firstUrl, fold, foldKeepLen, isDoneStatus } from "../text";
import { findHeaderRow, uniqueKey, type ParsedDeadline, type TabValues } from "./types";

const EVENT_PREFIXES = ["chuong trinh ", "kich ban to chuc "];

export type EventInfo = { label: string | null; day: string | null };

/** "… | Chương trình <name> <dd/mm/yyyy>" (or "Kịch bản tổ chức <name> <date>") -> name + ISO day. */
export function eventFromTitle(fileName: string): EventInfo {
  const segment = fileName.split("|").pop()!.trim();
  const folded = foldKeepLen(segment);
  const prefix = EVENT_PREFIXES.find((p) => folded.startsWith(p));
  if (!prefix) return { label: null, day: null };
  const rest = segment.slice(prefix.length).trim();
  const m = rest.match(/^(.*?)[\s,(-]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\)?\s*$/);
  if (!m) return { label: rest || null, day: null };
  const day = extractDays(m[2], new Date().getFullYear())[0]?.day ?? null;
  return { label: m[1].trim() || null, day };
}

/** Event day from the Overview tab: first row whose label is "Thời gian". */
export function eventDayFromOverview(rows: string[][] | undefined, defaultYear: number): string | null {
  for (const row of rows ?? []) {
    const idx = row.findIndex((c) => fold(c ?? "") === "thoi gian");
    if (idx < 0) continue;
    const text = row.slice(idx + 1).join(" ");
    const day = extractDays(text, defaultYear)[0]?.day;
    if (day) return day;
  }
  return null;
}

/** Tabs worth fetching for this parser: the "Phân công" tabs plus the Overview tab. */
export function mlsvTabs(titles: string[]): string[] {
  const assign = titles.filter((t) => fold(t).includes("phan cong"));
  if (assign.length === 0) return [];
  const overview = titles.find((t) => fold(t).includes("overview"));
  return overview ? [...assign, overview] : assign;
}

function isBcm(phanCong: string): boolean {
  const f = fold(phanCong);
  return f.includes("ban chuyen mon") || /\bbcm\b/.test(f);
}

export function parseMlsvEvent(input: { fileId: string; fileName: string; tabs: TabValues; now?: Date }): ParsedDeadline[] {
  const now = input.now ?? new Date();
  const fromTitle = eventFromTitle(input.fileName);
  const overviewKey = Object.keys(input.tabs).find((t) => fold(t).includes("overview"));
  const eventDay =
    fromTitle.day ?? eventDayFromOverview(overviewKey ? input.tabs[overviewKey] : undefined, now.getFullYear());
  const groupLabel = fromTitle.label ?? (input.fileName.split("|").pop()!.trim() || null);
  const groupDate = eventDay ? new Date(localDateTime(eventDay, "00:00")) : null;
  const defaultYear = eventDay ? Number(eventDay.slice(0, 4)) : now.getFullYear();

  const out: ParsedDeadline[] = [];
  const seen = new Set<string>();
  for (const [tab, rows] of Object.entries(input.tabs)) {
    if (!fold(tab).includes("phan cong")) continue;
    const header = findHeaderRow(
      rows,
      (f) => findCol(f, "phan cong") >= 0 && findCol(f, "moc thoi gian") >= 0,
      fold,
    );
    if (!header) continue;
    const titleExact = findCol(header.folded, "hang muc cong viec");
    const col = {
      stt: findCol(header.folded, "stt"),
      title: titleExact >= 0 ? titleExact : findCol(header.folded, "hang muc"),
      assign: findCol(header.folded, "phan cong"),
      owner: findCol(header.folded, "nguoi phu trach"),
      due: findCol(header.folded, "moc thoi gian"),
      status: findCol(header.folded, "trang thai"),
      link: findCol(header.folded, "tai lieu"),
    };
    if (col.title < 0) continue;

    for (let i = header.index + 1; i < rows.length; i++) {
      const row = rows[i];
      const title = cell(row, col.title);
      if (!title || !isBcm(cell(row, col.assign))) continue;
      const stt = cell(row, col.stt);
      const dueText = cell(row, col.due);
      const status = cell(row, col.status);
      out.push({
        rowKey: uniqueKey(`${input.fileId}:${tab}:${stt || i + 1}`, seen),
        title,
        dueAt: parseDue(dueText, defaultYear),
        rawText: dueText,
        assignee: cell(row, col.owner) || null,
        status: status || null,
        done: isDoneStatus(status),
        link: firstUrl(cell(row, col.link)),
        groupLabel,
        groupDate,
      });
    }
  }
  return out;
}

import { localDateTime } from "@/lib/time";
import type { TabConfig } from "../config";
import { extractDays, parseTimeOfDay } from "../dates";
import { cell, findCol, firstUrl, fold, isDoneStatus } from "../text";
import { findHeaderRow, uniqueKey, type ParsedDeadline, type TabValues } from "./types";

/** Sheet tab titles that match a configured tab (accent-insensitive, exact). */
export function tableTaskTabs(titles: string[], tabs: TabConfig[]): string[] {
  const wanted = new Set(tabs.map((t) => fold(t.tab)));
  return titles.filter((t) => wanted.has(fold(t)));
}

export function parseTableTasks(input: {
  fileId: string;
  fileName: string;
  tabs: TabConfig[];
  values: TabValues;
  now?: Date;
}): ParsedDeadline[] {
  const now = input.now ?? new Date();
  const out: ParsedDeadline[] = [];
  const seen = new Set<string>();

  for (const [tabName, rows] of Object.entries(input.values)) {
    const cfg = input.tabs.find((t) => fold(t.tab) === fold(tabName));
    if (!cfg) continue;
    const header = findHeaderRow(
      rows,
      (f) => findCol(f, cfg.title) >= 0 && (findCol(f, cfg.due) >= 0 || (!!cfg.fallbackDue && findCol(f, cfg.fallbackDue) >= 0)),
      fold,
    );
    if (!header) continue;
    const col = {
      title: findCol(header.folded, cfg.title),
      due: findCol(header.folded, cfg.due),
      fallback: cfg.fallbackDue ? findCol(header.folded, cfg.fallbackDue) : -1,
      time: cfg.time ? findCol(header.folded, cfg.time) : -1,
      status: cfg.status ? findCol(header.folded, cfg.status) : -1,
      group: cfg.group ? findCol(header.folded, cfg.group) : -1,
      assignee: cfg.assignee.map((a) => findCol(header.folded, a)).filter((i) => i >= 0),
    };

    // First pass: raw date text per row (year not filled in yet) so a row without a year can borrow a neighbour's.
    const pending: { i: number; text: string; days: ReturnType<typeof extractDays> }[] = [];
    for (let i = header.index + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!cell(row, col.title)) continue;
      let text = cell(row, col.due);
      if (!extractDays(text, 2000).length && col.fallback >= 0) text = cell(row, col.fallback);
      pending.push({ i, text, days: extractDays(text, 2000) });
    }
    const explicitYear = (k: number): number | null => {
      const withYear = pending[k].days.filter((x) => x.hasYear);
      return withYear.length ? Number(withYear[withYear.length - 1].day.slice(0, 4)) : null;
    };
    const years = pending.map((_, k) => {
      const own = explicitYear(k);
      if (own !== null) return own;
      for (let j = k - 1; j >= 0; j--) {
        const y = explicitYear(j);
        if (y !== null) return y;
      }
      for (let j = k + 1; j < pending.length; j++) {
        const y = explicitYear(j);
        if (y !== null) return y;
      }
      return now.getFullYear();
    });

    pending.forEach((p, k) => {
      const row = rows[p.i];
      const assignee = col.assignee.map((c) => cell(row, c)).filter(Boolean).join(" · ");
      const status = cell(row, col.status);
      const days = extractDays(p.text, years[k]);
      const last = days[days.length - 1];
      // section-title rows: a title with no date, owner or status
      if (!last && !assignee && !status) return;
      const time = parseTimeOfDay(cell(row, col.time)) ?? "23:59";
      out.push({
        // keyed by title, not row number: inserting a row must not move the user's progress to another task
        rowKey: uniqueKey(`${input.fileId}:${tabName}:${fold(cell(row, col.title))}`, seen),
        title: cell(row, col.title),
        dueAt: last ? new Date(localDateTime(last.day, time)) : null,
        rawText: p.text,
        assignee: assignee || null,
        status: status || null,
        done: isDoneStatus(status),
        link: firstUrl(row.join(" ")),
        groupLabel: cell(row, col.group) || input.fileName,
        groupDate: null,
      });
    });
  }
  return out;
}

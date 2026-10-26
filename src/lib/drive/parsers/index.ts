import type { SourceConfig } from "../config";
import { mlsvTabs, parseMlsvEvent } from "./mlsv";
import { parseTableTasks, tableTaskTabs } from "./table-tasks";
import type { ParsedDeadline, TabValues } from "./types";

export type { ParsedDeadline, TabValues } from "./types";

/** Which tabs of a spreadsheet the source's parser needs (empty = file does not match). */
export function tabsToFetch(config: SourceConfig, titles: string[]): string[] {
  return config.parser === "mlsv_event_sheet" ? mlsvTabs(titles) : tableTaskTabs(titles, config.tabs);
}

export function parseSheet(
  config: SourceConfig,
  file: { id: string; name: string },
  values: TabValues,
  now?: Date,
): ParsedDeadline[] {
  if (config.parser === "mlsv_event_sheet") {
    return parseMlsvEvent({ fileId: file.id, fileName: file.name, tabs: values, now });
  }
  return parseTableTasks({ fileId: file.id, fileName: file.name, tabs: config.tabs, values, now });
}

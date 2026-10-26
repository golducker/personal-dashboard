import { z } from "zod";

export const tabConfigSchema = z.object({
  tab: z.string().min(1),
  title: z.string().min(1),
  due: z.string().min(1),
  time: z.string().min(1).optional(),
  fallbackDue: z.string().min(1).optional(),
  assignee: z.array(z.string().min(1)).max(6).default([]),
  status: z.string().min(1).optional(),
  group: z.string().min(1).optional(),
});

export const sourceConfigSchema = z.discriminatedUnion("parser", [
  z.object({ parser: z.literal("mlsv_event_sheet") }),
  z.object({ parser: z.literal("table_tasks"), tabs: z.array(tabConfigSchema).min(1).max(20) }),
]);

export type TabConfig = z.infer<typeof tabConfigSchema>;
export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export type ParserName = "none" | SourceConfig["parser"];

export const DEFAULT_WORK_CONFIG: SourceConfig = {
  parser: "table_tasks",
  tabs: [
    { tab: "Timeline", title: "Việc cần làm", due: "Ngày", time: "Giờ", assignee: ["Owner", "Phối hợp"], status: "Trạng thái" },
    { tab: "Lịch đăng bài", title: "Chuyên mục / Bài", due: "Deadline", fallbackDue: "Ngày", assignee: ["PIC"], status: "Trạng thái" },
  ],
};

export function defaultParser(profile: string): ParserName {
  if (profile === "mlsv") return "mlsv_event_sheet";
  if (profile === "work") return "table_tasks";
  return "none";
}

export function defaultConfig(parser: ParserName): SourceConfig | null {
  if (parser === "mlsv_event_sheet") return { parser };
  if (parser === "table_tasks") return DEFAULT_WORK_CONFIG;
  return null;
}

/** Stored config -> validated config, or null when absent/invalid (source then only indexes files). */
export function readConfig(raw: unknown): SourceConfig | null {
  const r = sourceConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_CONFIG } from "../config";
import { eventFromTitle, parseMlsvEvent } from "./mlsv";
import { parseSheet, tabsToFetch } from "./index";
import { parseTableTasks } from "./table-tasks";

// All data below is invented.
const NOW = new Date("2026-10-26T03:00:00Z");

const HEADER = ["STT", "Hạng mục công việc", "Nội dung chi tiết", "Phân công", "Người phụ trách", "Mốc thời gian", "Trạng thái", "Tài liệu & Link"];

describe("eventFromTitle", () => {
  it("reads the name and date from the file title", () => {
    expect(eventFromTitle("Sheet | Chương trình Alpha Night 20/11/2026")).toEqual({ label: "Alpha Night", day: "2026-11-20" });
    expect(eventFromTitle("Kịch bản tổ chức Beta Day 05/12/2026")).toEqual({ label: "Beta Day", day: "2026-12-05" });
    expect(eventFromTitle("Something else")).toEqual({ label: null, day: null });
  });
});

describe("parseMlsvEvent", () => {
  const tabs = {
    Overview: [["", "Thời gian", "12/11/2026 - 13/11/2026"]],
    "Phân công": [
      ["", "Kế hoạch chương trình"],
      [],
      // data starts at column B and the header row is not the first
      ["", ...HEADER],
      ["", "1", "Chốt nội dung", "chi tiết", "Ban Truyền thông, Ban Chuyên môn", "Nguyễn Văn A", "Trước 15/10/2026", "Hoàn thành", "xem https://example.com/doc"],
      ["", "2", "Viết kịch bản", "", "BCM", "Trần Thị B", "01/10 - 04/11", "Đang làm", ""],
      ["", "3", "Thuê địa điểm", "", "Ban Hậu cần", "Lê C", "01/11/2026", "", ""],
      ["", "4", "Gửi thư mời", "", "ban chuyên môn", "", "sớm", "Chưa hoàn thành", ""],
      ["", "5", "", "", "BCM", "", "01/11/2026", "", ""],
    ],
  };

  it("accepts a due column named Deadline", () => {
    const header = HEADER.map((h) => (h === "Mốc thời gian" ? "Deadline" : h));
    const rows = parseMlsvEvent({
      fileId: "F2",
      fileName: "X | Chương trình Gamma Talk 21/10/2026",
      tabs: { "2. Phân công Nhân sự": [[], ["", ...header], ["", "1", "Soạn câu hỏi", "", "Ban Chuyên môn", "", "18/10/2026", "", ""]] },
      now: NOW,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].dueAt?.toISOString()).toBe("2026-10-18T16:59:00.000Z");
  });

  it("keeps only BCM rows and maps columns by header", () => {
    const rows = parseMlsvEvent({ fileId: "F1", fileName: "X | Chương trình Alpha Night 20/11/2026", tabs, now: NOW });
    expect(rows.map((r) => r.title)).toEqual(["Chốt nội dung", "Viết kịch bản", "Gửi thư mời"]);
    expect(rows[0]).toMatchObject({
      rowKey: "F1:Phân công:1",
      assignee: "Nguyễn Văn A",
      done: true,
      link: "https://example.com/doc",
      groupLabel: "Alpha Night",
    });
    expect(rows[0].dueAt?.toISOString()).toBe("2026-10-15T16:59:00.000Z");
    expect(rows[0].groupDate?.toISOString()).toBe("2026-11-19T17:00:00.000Z");
    // no year -> event year; range -> last day
    expect(rows[1].dueAt?.toISOString()).toBe("2026-11-04T16:59:00.000Z");
    expect(rows[1].done).toBe(false);
    // unparseable due -> null, row still kept
    expect(rows[2].dueAt).toBeNull();
    expect(rows[2].done).toBe(false);
  });

  it("falls back to the Overview tab for the event date", () => {
    const rows = parseMlsvEvent({ fileId: "F1", fileName: "Plain name", tabs, now: NOW });
    expect(rows[0].groupLabel).toBe("Plain name");
    expect(rows[0].groupDate?.toISOString()).toBe("2026-11-11T17:00:00.000Z");
  });

  it("returns nothing when there is no valid header", () => {
    expect(parseMlsvEvent({ fileId: "F", fileName: "x", tabs: { "Phân công": [["a", "b"]] }, now: NOW })).toEqual([]);
  });

  it("makes duplicate STT keys unique", () => {
    const dup = { "Phân công": [HEADER, ["1", "A", "", "BCM", "", "", "", ""], ["1", "B", "", "BCM", "", "", "", ""]] };
    const keys = parseMlsvEvent({ fileId: "F", fileName: "x", tabs: dup, now: NOW }).map((r) => r.rowKey);
    expect(new Set(keys).size).toBe(2);
  });

  it("selects the tabs to fetch", () => {
    expect(tabsToFetch({ parser: "mlsv_event_sheet" }, ["Overview", "Phân công BTC", "Budget"])).toEqual(["Phân công BTC", "Overview"]);
    expect(tabsToFetch({ parser: "mlsv_event_sheet" }, ["Budget"])).toEqual([]);
  });
});

describe("parseTableTasks", () => {
  const values = {
    Timeline: [
      ["Kế hoạch dự án"],
      ["Việc cần làm", "Ngày", "Giờ", "Owner", "Phối hợp", "Trạng thái"],
      ["Họp kickoff", "12/10/2026", "9:30", "An", "Bình", "Done"],
      ["Soạn brief", "13/10", "", "Chi", "", "Đang làm"],
      ["GIAI ĐOẠN 2", "", "", "", "", ""],
      ["Review", "", "", "Dũng", "", "Chưa làm"],
    ],
    "Lịch đăng bài": [
      ["Chuyên mục / Bài", "Deadline", "Ngày", "PIC", "Trạng thái"],
      ["Bài 1", "", "20/10/2026", "An", "Hoàn thành"],
      ["Bài 2", "18/10/2026", "25/10/2026", "Bình", ""],
    ],
  };
  const tabCfg = DEFAULT_WORK_CONFIG.parser === "table_tasks" ? DEFAULT_WORK_CONFIG.tabs : [];
  const rows = parseTableTasks({ fileId: "S1", fileName: "Project sheet", tabs: tabCfg, values, now: NOW });

  it("keeps every assignee and joins owner and collaborators", () => {
    expect(rows.map((r) => r.title)).toEqual(["Họp kickoff", "Soạn brief", "Review", "Bài 1", "Bài 2"]);
    expect(rows[0].assignee).toBe("An · Bình");
    expect(rows[0].dueAt?.toISOString()).toBe("2026-10-12T02:30:00.000Z");
    expect(rows[0].done).toBe(true);
    expect(rows[0].groupLabel).toBe("Project sheet");
  });

  it("infers a missing year from neighbours and skips section rows", () => {
    expect(rows[1].dueAt?.toISOString()).toBe("2026-10-13T16:59:00.000Z");
    expect(rows.some((r) => r.title === "GIAI ĐOẠN 2")).toBe(false);
    expect(rows[2].dueAt).toBeNull();
  });

  it("uses the fallback due column", () => {
    expect(rows[3].dueAt?.toISOString()).toBe("2026-10-20T16:59:00.000Z");
    expect(rows[4].dueAt?.toISOString()).toBe("2026-10-18T16:59:00.000Z");
    expect(rows[3].done).toBe(true);
    expect(rows[4].rowKey).toBe("S1:Lịch đăng bài:bai 2");
  });

  it("matches tabs without accents and ignores unrelated sheets", () => {
    expect(tabsToFetch(DEFAULT_WORK_CONFIG, ["Timeline", "Lich dang bai", "Other"])).toEqual(["Timeline", "Lich dang bai"]);
    expect(parseSheet(DEFAULT_WORK_CONFIG, { id: "x", name: "y" }, { Other: [["a"]] })).toEqual([]);
  });
});

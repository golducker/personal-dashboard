import { describe, expect, it } from "vitest";
import { examsView, noticesView, roomName, toDayKey, toTime, weekView } from "./view";

// Invented data in the eduSoft shape.
const schedule = {
  week: {
    ds_tiet_trong_ngay: [
      { tiet: 1, gio_bat_dau: "6:45", gio_ket_thuc: "07:30" },
      { tiet: 2, gio_bat_dau: "7:30", gio_ket_thuc: "08:15" },
      { tiet: 3, gio_bat_dau: "8:20", gio_ket_thuc: "09:05" },
    ],
    ds_tuan_tkb: [
      {
        tuan_hoc_ky: 2,
        ngay_bat_dau: "02/11/2026",
        ngay_ket_thuc: "08/11/2026",
        ds_thoi_khoa_bieu: [{ ngay_hoc: "2026-11-03T00:00:00", tiet_bat_dau: 1, so_tiet: 2, ma_mon: "AAA100", ten_mon: "Môn A", ma_phong: "1XYZ01-Phòng học A101" }],
      },
      {
        tuan_hoc_ky: 1,
        ngay_bat_dau: "26/10/2026",
        ngay_ket_thuc: "01/11/2026",
        ds_thoi_khoa_bieu: [
          { ngay_hoc: "2026-10-27T00:00:00", tiet_bat_dau: 2, so_tiet: 2, ma_mon: "BBB200", ten_mon: "Môn B", ma_phong: "" },
          { ngay_hoc: "2026-10-27T00:00:00", tiet_bat_dau: 1, so_tiet: 1, ma_mon: "CCC300", ten_mon: "Môn C" },
        ],
      },
    ],
  },
};

describe("formats", () => {
  it("parses FTUgate dates and times", () => {
    expect(toDayKey("05/09/2026")).toBe("2026-09-05");
    expect(toDayKey("2026-09-04T14:41:27.27")).toBe("2026-09-04");
    expect(toDayKey("")).toBeNull();
    expect(toTime("6:45")).toBe("06:45");
    expect(toTime("x")).toBeNull();
  });
  it("drops the class-group prefix from room names", () => {
    expect(roomName("1HCA0601-Phòng học A601")).toBe("Phòng học A601");
    expect(roomName("A-101")).toBe("A-101");
    expect(roomName("")).toBeNull();
  });
});

describe("weekView", () => {
  it("picks the week containing today and sorts classes by time", () => {
    const w = weekView(schedule, "2026-10-27")!;
    expect(w).toMatchObject({ semesterWeek: 1, range: "26/10 - 01/11", isCurrent: true });
    expect(w.days).toHaveLength(7);
    const tue = w.days.find((d) => d.isToday)!;
    expect(tue.weekday).toBe("Thứ Ba");
    expect(tue.classes.map((c) => [c.code, c.start, c.end])).toEqual([
      ["CCC300", "06:45", "07:30"],
      ["BBB200", "07:30", "09:05"],
    ]);
  });
  it("falls forward to the next week with classes between semesters", () => {
    const w = weekView(schedule, "2026-10-20")!;
    expect(w).toMatchObject({ semesterWeek: 1, isCurrent: false });
    expect(weekView(schedule, "2026-11-02")!.days[1].classes[0].room).toBe("Phòng học A101");
  });
  it("returns null on garbage", () => {
    expect(weekView(null, "2026-10-27")).toBeNull();
    expect(weekView({ week: { ds_tuan_tkb: "x" } }, "2026-10-27")).toBeNull();
  });
});

describe("examsView", () => {
  const payload = {
    exams: {
      ds_lich_thi: [
        { ngay_thi: "10/11/2026", gio_bat_dau: "14:30", so_phut: "90", ma_mon: "AAA100", ten_mon: "Môn A" },
        { ngay_thi: "26/10/2026", gio_bat_dau: "7:00", ma_mon: "BBB200", ten_mon: "Môn B" },
        { ngay_thi: "14/10/2026", ma_mon: "CCC300", ten_mon: "Môn C" },
      ],
    },
  };
  it("keeps exams from today on, soonest first, with a countdown", () => {
    const e = examsView(payload, "2026-10-26");
    expect(e.map((x) => [x.code, x.daysLeft])).toEqual([
      ["BBB200", 0],
      ["AAA100", 15],
    ]);
    expect(e[1]).toMatchObject({ time: "14:30", minutes: 90 });
  });
});

describe("noticesView", () => {
  it("maps titles, dates and read state", () => {
    const n = noticesView({ notices: { ds_thong_bao: [{ id: 7, tieu_de: "Tiêu đề", ngay_gui: "2026-09-04T14:41:27", is_da_doc: false }, { tieu_de: "" }] } });
    expect(n).toEqual([{ id: "7", title: "Tiêu đề", date: "2026-09-04", unread: true }]);
  });
});

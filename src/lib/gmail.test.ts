import { describe, expect, it } from "vitest";
import { dueFromSubject, parseIcs } from "./gmail";

const ics = (body: string, head = "METHOD:REQUEST") =>
  ["BEGIN:VCALENDAR", head, "BEGIN:VEVENT", ...body.split("\n"), "END:VEVENT", "END:VCALENDAR"].join("\r\n");

describe("parseIcs", () => {
  it("reads a TZID timed event with folded and escaped text", () => {
    const ev = parseIcs(
      ics(
        "UID:abc@x\nSUMMARY:Họp nhóm\\, tuần 3\nDTSTART;TZID=Asia/Ho_Chi_Minh:20261120T140000\nDTEND;TZID=Asia/Ho_Chi_Minh:20261120T153000\nLOCATION:Phòng A\n  101\nBEGIN:VALARM\nDESCRIPTION:reminder\nEND:VALARM",
      ),
    );
    expect(ev).toEqual({
      uid: "abc@x",
      title: "Họp nhóm, tuần 3",
      start: { dateTime: "2026-11-20T14:00:00", timeZone: "Asia/Ho_Chi_Minh" },
      end: { dateTime: "2026-11-20T15:30:00", timeZone: "Asia/Ho_Chi_Minh" },
      location: "Phòng A 101",
      description: undefined,
    });
  });

  it("handles UTC, Windows TZIDs and all-day without DTEND", () => {
    expect(parseIcs(ics("UID:1\nDTSTART:20261120T070000Z"))!.start).toEqual({ dateTime: "2026-11-20T07:00:00Z" });
    expect(parseIcs(ics('UID:2\nDTSTART;TZID="SE Asia Standard Time":20261120T090000'))!.start).toEqual({
      dateTime: "2026-11-20T09:00:00",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const day = parseIcs(ics("UID:3\nDTSTART;VALUE=DATE:20261130"))!;
    expect([day.start, day.end]).toEqual([{ date: "2026-11-30" }, { date: "2026-12-01" }]);
  });

  it("skips cancellations and broken files", () => {
    expect(parseIcs(ics("UID:1\nDTSTART:20261120T070000Z", "METHOD:CANCEL"))).toBeNull();
    expect(parseIcs(ics("UID:1\nSTATUS:CANCELLED\nDTSTART:20261120T070000Z"))).toBeNull();
    expect(parseIcs(ics("SUMMARY:no uid\nDTSTART:20261120T070000Z"))).toBeNull();
    expect(parseIcs("hello")).toBeNull();
  });
});

describe("dueFromSubject", () => {
  const now = new Date("2026-11-17T03:00:00Z");
  it("takes the first date from today on", () => {
    expect(dueFromSubject("[KTVM] Hạn nộp bài 25/11", now)).toBe("25/11/2026");
    expect(dueFromSubject("Nhắc nhở: buổi 10/11 đã qua, hạn mới 01/12/2026", now)).toBe("01/12/2026");
    expect(dueFromSubject("Deadline sắp tới", now)).toBeUndefined();
  });
});

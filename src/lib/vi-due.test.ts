import { describe, expect, it } from "vitest";
import { viDueToEnglish } from "./vi-due";

describe("viDueToEnglish", () => {
  it.each([
    ["hôm nay", "today"],
    ["mai 9h", "tomorrow at 9:00"],
    ["ngày mai 9h30", "tomorrow at 9:30"],
    ["mai 3h chiều", "tomorrow at 15:00"],
    ["ngày kia", "in 2 days"],
    ["thứ 6", "friday"],
    ["thứ hai tuần sau", "next monday"],
    ["chủ nhật 20h", "sunday at 20:00"],
    ["27/10", "27 oct"],
    ["5/1/2027 8h", "5 jan 2027 at 8:00"],
    ["hằng ngày 7h", "every day at 7:00"],
    ["3 ngày nữa", "in 3 days"],
    ["tuần sau", "next week"],
    ["tomorrow 9am", "tomorrow 9am"],
  ])("%s -> %s", (vi, en) => {
    expect(viDueToEnglish(vi)).toBe(en);
  });
});

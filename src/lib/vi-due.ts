// Todoist's natural-language due parser has no Vietnamese (due_lang "vi" is rejected),
// so common Vietnamese phrases are rewritten into English before sending with due_lang "en".

const WEEKDAYS: Array<[RegExp, string]> = [
  [/thứ\s*(2|hai)/g, "monday"],
  [/thứ\s*(3|ba)/g, "tuesday"],
  [/thứ\s*(4|tư)/g, "wednesday"],
  [/thứ\s*(5|năm)/g, "thursday"],
  [/thứ\s*(6|sáu)/g, "friday"],
  [/thứ\s*(7|bảy)/g, "saturday"],
  [/(chủ\s*nhật|\bcn\b)/g, "sunday"],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function viDueToEnglish(input: string): string {
  let s = input.trim().toLowerCase().normalize("NFC");

  // Times: "9h", "9h30", "3h chiều", "9 giờ tối" -> "at 15:00"
  s = s.replace(/(\d{1,2})\s*(?:h|giờ)\s*(\d{2})?(?:\s*(sáng|trưa|chiều|tối))?/g, (_, h, m, part) => {
    let hour = Number(h);
    if ((part === "chiều" || part === "tối") && hour < 12) hour += 12;
    if (part === "trưa" && hour < 11) hour += 12;
    return `at ${hour}:${m ?? "00"}`;
  });

  // Dates: "27/10" or "27/10/2026" -> "27 oct" / "27 oct 2026"
  s = s.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g, (all, d, mo, y) => {
    const name = MONTHS[Number(mo) - 1];
    return name ? `${Number(d)} ${name}${y ? ` ${y}` : ""}` : all;
  });

  // "thứ 2 tuần sau" -> "next monday" (before plain weekday/"tuần sau" rules)
  for (const [re, day] of WEEKDAYS) {
    s = s.replace(new RegExp(`${re.source}\\s*tuần\\s*(sau|tới)`, "g"), `next ${day}`);
  }

  const phrases: Array<[RegExp, string]> = [
    [/(hằng|hàng|mỗi)\s*ngày/g, "every day"],
    [/(hằng|hàng|mỗi)\s*tuần/g, "every week"],
    [/(hằng|hàng|mỗi)\s*tháng/g, "every month"],
    [/ngày\s*kia/g, "in 2 days"],
    [/(ngày\s*)?mai/g, "tomorrow"],
    [/hôm\s*nay|hnay/g, "today"],
    [/tối\s*nay/g, "today at 20:00"],
    [/tuần\s*(sau|tới)/g, "next week"],
    [/tháng\s*(sau|tới)/g, "next month"],
    [/(\d+)\s*ngày\s*nữa/g, "in $1 days"],
  ];
  for (const [re, en] of phrases) s = s.replace(re, en);
  for (const [re, day] of WEEKDAYS) s = s.replace(re, day);

  return s.replace(/\s+/g, " ").trim();
}

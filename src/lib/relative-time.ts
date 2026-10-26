const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTimeVi(iso: string | Date, now: Date = new Date()): string {
  const diffSec = Math.round((+new Date(iso) - +now) / 1000);
  const abs = Math.abs(diffSec);
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return "vừa xong";
}

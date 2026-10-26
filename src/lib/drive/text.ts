/** Length-preserving fold: strips Vietnamese diacritics per character and lowercases. */
export function foldKeepLen(s: string): string {
  return Array.from(s.normalize("NFC"))
    .map((c) => (c === "đ" || c === "Đ" ? "d" : c.normalize("NFD")[0]))
    .join("")
    .toLowerCase();
}

/** Accent-stripped, lowercased, whitespace-collapsed. */
export function fold(s: string): string {
  return foldKeepLen(s).replace(/\s+/g, " ").trim();
}

export function cell(row: string[] | undefined, idx: number): string {
  if (!row || idx < 0) return "";
  return (row[idx] ?? "").toString().trim();
}

/** Index of the column whose folded header equals `name` (preferred) or contains it; -1 if none. */
export function findCol(headerFolded: string[], name: string): number {
  const n = fold(name);
  if (!n) return -1;
  const exact = headerFolded.indexOf(n);
  return exact >= 0 ? exact : headerFolded.findIndex((h) => h.includes(n));
}

export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/i);
  return m ? m[0] : null;
}

const DONE_RE = /\b(done|hoan thanh|hoan tat|xong|completed?)\b/;
const NOT_RE = /\b(chua|not|khong|dang)\b/;

/** "Hoàn thành" / "Done" / "Xong" count; "Chưa hoàn thành" does not. */
export function isDoneStatus(status: string): boolean {
  const f = fold(status);
  return DONE_RE.test(f) && !NOT_RE.test(f);
}

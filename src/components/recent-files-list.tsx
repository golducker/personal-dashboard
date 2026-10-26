"use client";

import { useState } from "react";
import { Empty, Pill } from "./card";

export type RecentFileItem = { id: string; name: string; path: string; url: string; profileLabel: string; ago: string | null };
export type RecentFileTab = { key: string; label: string; files: RecentFileItem[] };

/** Profile tabs switch the list in place; every tab's files are loaded up front by the server panel. */
export function RecentFilesList({ tabs }: { tabs: RecentFileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const rows = tabs.find((t) => t.key === active)?.files ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo hồ sơ">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <Empty>Chưa có file nào.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((f) => (
            <li key={f.id} className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <a href={f.url} target="_blank" rel="noreferrer" className="block text-sm leading-5 font-medium break-words hover:underline">
                  {f.name}
                </a>
                <span className="block truncate text-xs text-ink-3">{f.path}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Pill>{f.profileLabel}</Pill>
                {f.ago && <span className="text-xs text-ink-3">{f.ago}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

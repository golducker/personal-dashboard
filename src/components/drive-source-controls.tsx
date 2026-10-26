"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_WORK_CONFIG, defaultParser, type ParserName } from "@/lib/drive/config";
import { relativeTimeVi } from "@/lib/relative-time";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_PRIMARY, INPUT, Pill } from "./card";

const PROFILES = [
  { value: "work", label: "Công việc" },
  { value: "mlsv", label: "MLSV" },
  { value: "study", label: "Học tập" },
  { value: "brain", label: "Second brain" },
] as const;

const PARSERS: { value: ParserName; label: string }[] = [
  { value: "none", label: "Chỉ lập chỉ mục file" },
  { value: "mlsv_event_sheet", label: "Sheet sự kiện MLSV (task Ban Chuyên môn)" },
  { value: "table_tasks", label: "Bảng task theo cột (cấu hình JSON)" },
];

const DEFAULT_TABLE_JSON = JSON.stringify(DEFAULT_WORK_CONFIG, null, 2);

export type SourceView = {
  id: string;
  label: string;
  kind: string;
  profile: string;
  parser: string;
  configJson: string;
  files: number;
  deadlines: number;
  lastSyncedAt: string | null;
};

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

async function request<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, ...data };
    const issues = Array.isArray(data.issues) && data.issues.length ? ` (${data.issues.join("; ")})` : "";
    return { ok: false, error: `${data.error ?? `Lỗi ${res.status}`}${issues}` };
  } catch {
    return { ok: false, error: "Không thể kết nối tới máy chủ." };
  }
}

/** Parses the config textarea; returns null config for "none". */
function parseConfig(parser: ParserName, text: string): { ok: true; config: unknown } | { ok: false; error: string } {
  if (parser === "none") return { ok: true, config: null };
  if (parser === "mlsv_event_sheet") return { ok: true, config: { parser } };
  try {
    return { ok: true, config: JSON.parse(text) };
  } catch {
    return { ok: false, error: "JSON không hợp lệ." };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-ink-2">
      {label}
      {children}
    </label>
  );
}

export function AddDriveSource() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [found, setFound] = useState<{ googleId: string; kind: string; name: string } | null>(null);
  const [label, setLabel] = useState("");
  const [profile, setProfile] = useState<(typeof PROFILES)[number]["value"]>("work");
  const [parser, setParser] = useState<ParserName>("table_tasks");
  const [json, setJson] = useState(DEFAULT_TABLE_JSON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    const r = await request<{ googleId: string; kind: string; name: string }>("POST", "/api/drive/sources/inspect", { url: link });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFound({ googleId: r.googleId, kind: r.kind, name: r.name });
    setLabel(r.name);
  }

  function pickProfile(p: (typeof PROFILES)[number]["value"]) {
    setProfile(p);
    const next = defaultParser(p);
    setParser(next);
    setJson(DEFAULT_TABLE_JSON);
  }

  async function save() {
    if (!found) return;
    const cfg = parseConfig(parser, json);
    if (!cfg.ok) return setError(cfg.error);
    setBusy(true);
    setError(null);
    const r = await request("POST", "/api/drive/sources", {
      googleId: found.googleId,
      kind: found.kind,
      label,
      profile,
      config: cfg.config,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFound(null);
    setLink("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-4">
      <p className="text-sm font-medium">Thêm nguồn</p>
      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setFound(null);
          }}
          placeholder="Dán link thư mục, shared drive hoặc Google Sheet"
          aria-label="Link Drive"
          className={`${INPUT} min-w-0 flex-1`}
        />
        <button type="button" disabled={busy || !link.trim()} onClick={check} className={BTN}>
          Kiểm tra
        </button>
      </div>

      {found && (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            Truy cập được. Loại: <b>{found.kind}</b>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên hiển thị">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} maxLength={80} />
            </Field>
            <Field label="Hồ sơ">
              <select value={profile} onChange={(e) => pickProfile(e.target.value as typeof profile)} className={INPUT}>
                {PROFILES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Cách đọc deadline">
            <select value={parser} onChange={(e) => setParser(e.target.value as ParserName)} className={INPUT}>
              {PARSERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {parser === "table_tasks" && (
            <Field label="Cấu hình (JSON)">
              <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={10} spellCheck={false} className={`${INPUT} font-mono text-xs`} />
            </Field>
          )}
          <button type="button" disabled={busy || !label.trim()} onClick={save} className={BTN_PRIMARY}>
            Lưu nguồn
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function DriveSourceItem({ source }: { source: SourceView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "save" | "delete">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [json, setJson] = useState(source.configJson);
  const profileLabel = PROFILES.find((p) => p.value === source.profile)?.label ?? source.profile;

  async function sync() {
    setBusy("sync");
    setMessage(null);
    const r = await request<{ changed: number; parsed: number; upserted: number; pending: number; crawled: number }>(
      "POST",
      `/api/drive/sources/${source.id}/sync`,
    );
    setBusy(null);
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    const more = r.pending > 0 ? `, còn ${r.pending} sheet chờ lượt sau` : "";
    setMessage({ ok: true, text: `Đã đồng bộ: ${r.crawled + r.changed} file, ${r.parsed} sheet, ${r.upserted} task${more}.` });
    router.refresh();
  }

  async function saveConfig() {
    let config: unknown = null;
    if (json.trim()) {
      try {
        config = JSON.parse(json);
      } catch {
        return setMessage({ ok: false, text: "JSON không hợp lệ." });
      }
    }
    setBusy("save");
    setMessage(null);
    const r = await request("PATCH", `/api/drive/sources/${source.id}`, { config });
    setBusy(null);
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    setEditing(false);
    setMessage({ ok: true, text: "Đã lưu. Sheet sẽ được đọc lại ở lần sync tới." });
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    const r = await request("DELETE", `/api/drive/sources/${source.id}`);
    setBusy(null);
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    router.refresh();
  }

  return (
    <li className="space-y-3 py-3 first:pt-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{source.label}</p>
          <p className="text-xs text-ink-2">
            {source.kind} · {source.files} file · {source.deadlines} task ·{" "}
            {source.lastSyncedAt ? `sync ${relativeTimeVi(source.lastSyncedAt)}` : "chưa sync"}
          </p>
        </div>
        <Pill>{profileLabel}</Pill>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={busy !== null} onClick={sync} className={BTN}>
            {busy === "sync" ? "Đang sync..." : "Sync ngay"}
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className={BTN_GHOST}>
            Cấu hình
          </button>
          {confirm ? (
            <>
              <button type="button" disabled={busy !== null} onClick={remove} className={BTN_DANGER}>
                Xóa
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={BTN_GHOST}>
                Hủy
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className={BTN_GHOST}>
              Xóa
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="space-y-2">
          <p className="text-xs text-ink-2">
            Để trống = chỉ lập chỉ mục file. Ví dụ: {"{"}&quot;parser&quot;: &quot;mlsv_event_sheet&quot;{"}"} hoặc cấu hình table_tasks.
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={10}
            spellCheck={false}
            aria-label="Cấu hình JSON"
            className={`${INPUT} font-mono text-xs`}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null} onClick={saveConfig} className={BTN_PRIMARY}>
              Lưu cấu hình
            </button>
            <button type="button" onClick={() => { setEditing(false); setJson(source.configJson); }} className={BTN_GHOST}>
              Hủy
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </li>
  );
}

# Phase 3 plan — FTUgate scraper + báo điểm qua Telegram

Nguồn: `docs/handoff-phase3.md`, `docs/ftugate-recon.md`, `AGENTS.md` (Next 16.4.3 — đọc `node_modules/next/dist/docs/01-app` trước khi đụng route handler/page).

## Kiến trúc

```
GitHub Actions (cron / dispatch)
  └─ scripts/ftugate/scrape.ts  (Playwright chromium headless-shell)
       login form thật → mở #/tkb-tuan, #/lichthi, #/diem, #/thongbao
       → page.waitForResponse(endpoint) → lấy JSON (không tự gọi API, không đụng header chữ ký)
       → POST $DASHBOARD_URL/api/sync/ftugate  { snapshots: [{kind, payload}] }  hoặc { error: "<mã lỗi>" }
Vercel /api/sync/ftugate
  └─ normalize → canonical hash → nếu khác snapshot cuối: lưu ftu_snapshots
  └─ kind=grades: diff với snapshot cũ → grade_events (idempotent) → Telegram → notified_at
  └─ ghi sync_runs (success/error, items)
Trang "Hôm nay" đọc snapshot mới nhất mỗi kind → card TKB / lịch thi / điểm+GPA
```

Mọi logic xử lý dữ liệu nằm ở server (Vercel), scraper chỉ "lái trình duyệt + chuyển JSON". Log Actions chỉ in: `kind`, số bản ghi, HTTP status, mã lỗi.

## Bước làm

### 0. Recon form login + shape payload (local, không lên Actions)
- Mở `https://ftugate.ftu.edu.vn/#/` bằng Playwright local (headed) để lấy selector ô user/pass/nút đăng nhập và cách phát hiện login sai.
- Chạy scraper local với `FTU_USERNAME/FTU_PASSWORD` trong `.env.local` (**gng tự điền**), dump payload ra `.data/ftugate-sample/` (đã gitignore) để viết normalizer + type. Không commit sample thật; fixture test dùng dữ liệu bịa cùng shape.
- Xác định field nào biến động mỗi lần (timestamp, token…) để loại khỏi hash.

### 1. Scraper `scripts/ftugate/`
- `playwright` vào devDependencies (package không tự tải browser khi `npm ci` → Vercel build không nặng thêm).
- `scrape.ts`: arg `--kinds=grades` hoặc `--kinds=schedule,exams,notices,grades`.
  - Login 1 lần/run; timeout 30s/bước; retry 1 lần cho mỗi route; tổng job timeout 5 phút.
  - Phát hiện captcha/OTP/sai mật khẩu → dừng, POST `{ error: "captcha" | "login_failed" | "timeout" }`, exit 1. Không thử vượt.
  - Chỉ chấp nhận response `code` thành công; payload rỗng bất thường → coi là lỗi, không đè snapshot.
  - Không `console.log` payload, không screenshot/trace/artifact. Lỗi Playwright có thể chứa URL/selector — chỉ in `err.name` + mã lỗi tự đặt.
- `--dry-run` (local): ghi JSON ra `.data/` thay vì POST.

### 2. API `/api/sync/ftugate` (mở rộng stub)
- zod schema body: `{ snapshots: { kind: "schedule"|"exams"|"grades"|"notices", payload: unknown }[] }` hoặc `{ error: string }`. Giới hạn kích thước (Vercel 4.5 MB là đủ).
- Các nguồn khác giữ hành vi stub cũ.
- `src/lib/ftugate/normalize.ts`: payload thô → shape gọn (TKB: thứ/tiết/giờ/phòng/mã môn; lịch thi; điểm từng môn + GPA kỳ/tích lũy nếu payload có).
- `src/lib/ftugate/hash.ts`: stable JSON stringify (sort key) trên dữ liệu đã normalize → sha256.
- Lưu snapshot chỉ khi hash khác snapshot cuối cùng cùng kind; giữ tối đa ~30 snapshot/kind (xóa cũ).
- Migration mới:
  - index `ftu_snapshots (kind, fetched_at desc)`.
  - `grade_events.score_hash` + unique `(course_code, semester, score_hash)` → chạy lại không tạo event trùng.

### 3. Diff điểm + Telegram
- `src/lib/ftugate/grades-diff.ts` (pure, có test): so map `semester|course_code → score` cũ/mới → danh sách môn mới có điểm hoặc điểm đổi. Bỏ qua môn chưa có điểm (null/""), bỏ qua môn biến mất.
- **Baseline**: chưa có snapshot `grades` nào → chỉ lưu snapshot, không tạo event, không gửi.
- `src/lib/telegram.ts`: `sendTelegram(text)` (parse_mode HTML, escape), timeout 10s, không log nội dung.
- Luồng: insert `grade_events ... on conflict do nothing` → lấy các event `notified_at is null` → gửi 1 tin gộp (vd "🎓 Có điểm mới: DBA200I – 8.5 (B+)…") → set `notified_at`. Gửi lỗi thì để null, run sau gửi lại.
- Báo lỗi scraper: gửi Telegram khi chuyển từ ok → error (không spam mỗi run), và khi hồi phục.
- Workflow có `concurrency: ftugate` để 2 run không chồng nhau.

### 4. GitHub Actions `.github/workflows/ftugate.yml`
- Trigger:
  - `*/30 0-11 * * 1-6` (UTC) = 7:00–18:30 giờ VN, T2–T7 → `--kinds=grades`.
  - `30 22 * * *` (UTC) = 5:30 sáng VN → full (`schedule,exams,notices,grades`).
  - `workflow_dispatch` với input `kinds`.
  - Chọn kinds theo `github.event.schedule`.
- Steps: checkout → setup-node (cache npm) → `npm ci` → cache `~/.cache/ms-playwright` theo version playwright → `npx playwright install --with-deps --only-shell chromium` → `npx tsx scripts/ftugate/scrape.ts`.
- `permissions: contents: read`; `::add-mask::` cho `FTU_USERNAME` (MSSV); secret chỉ truyền qua `env` của step chạy scraper.
- Lưu ý: GitHub tắt cron của repo public sau 60 ngày không có commit — repo này commit thường xuyên nên ổn, nhưng health sẽ báo nếu FTUgate lâu không sync.

### 5. Health
- `SOURCE_ENV.ftugate = []` + coi ftugate "configured" khi đã có `sync_runs`; chưa có → `never_synced` thay vì `not_configured`.
- Thêm cảnh báo "stale" nếu lần success cuối > 3 giờ trong giờ hành chính (hiển thị trên `/health`).

### 6. UI trang "Hôm nay"
- `FtuScheduleCard`: lớp hôm nay (+ toggle cả tuần) từ snapshot `schedule`.
- `FtuExamsCard`: lịch thi sắp tới, đếm ngược ngày.
- `FtuGradesCard`: GPA tích lũy + điểm kỳ gần nhất, highlight môn có `grade_events` trong 7 ngày.
- Server component đọc DB trực tiếp, Suspense như CalendarSection.
- **Dedup Calendar**: không ghi TKB vào Google Calendar. TKB chỉ ở card riêng → không bao giờ trùng event DBA200I đã có.

### 7. Test + verify
- vitest: normalize (fixture bịa), hash ổn định khi đổi thứ tự key, grades-diff (baseline, môn mới, đổi điểm, chưa có điểm, môn biến mất), route sync (401, zod lỗi, idempotent).
- `npm run lint && npx tsc --noEmit && npm test && npm run build`.
- E2E: dispatch workflow → xanh, đọc log xác nhận không lộ dữ liệu → `/api/health` ftugate `ok` → sửa snapshot `grades` cũ trong Neon (xóa 1 môn) → dispatch → nhận đúng 1 tin Telegram → dispatch lại → không có tin mới.

### Ngoài scope (để Phase 5)
- Web push (chưa có VAPID).

## Secrets GitHub (chờ gng duyệt — chưa đặt)
| Secret | Nguồn | Ai nhập |
|---|---|---|
| `FTU_USERNAME` | MSSV | gng điền vào `.env.local` |
| `FTU_PASSWORD` | mật khẩu FTUgate | **gng tự điền** vào `.env.local` |
| `SYNC_SECRET` | `.env.local` (đã có, khớp Vercel) | Claude `gh secret set` từ file, không in ra |
| `DASHBOARD_URL` | `https://personal-dashboard-liard-five.vercel.app` | Claude |

Đặt bằng `gh secret set NAME --repo golducker/personal-dashboard` với giá trị pipe từ `.env.local` qua stdin, không echo.

## Rủi ro
- **IP GitHub runner ở nước ngoài** có thể bị FTUgate chặn/chậm → test bằng `workflow_dispatch` đầu tiên. Nếu bị chặn: self-hosted runner trên máy gng (chỉ chạy khi máy bật) — hỏi trước khi làm.
- Sau login trang chạy **HTTP không TLS**: token đi plaintext từ runner → trường. Chấp nhận (không có lựa chọn khác), không gửi gì thêm ngoài những gì trang tự gửi.
- Trường đổi UI/route/endpoint → scraper báo `timeout` → Telegram báo lỗi 1 lần, health đỏ.
- Mật khẩu FTU nằm trong GitHub secrets: chỉ dùng ở 1 step, không có workflow nào chạy từ PR fork (`pull_request_target` không dùng).

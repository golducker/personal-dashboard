# Phase 4 plan: Drive hub + deadline từ Drive

Nguồn: `docs/handoff-next.md`, `AGENTS.md` (Next 16.4.3, đọc `node_modules/next/dist/docs/01-app` trước khi đụng route handler/page).

Repo public ⇒ **không** commit folder/file ID, tên người, tên sự kiện thật. Mọi cấu hình nguồn lưu trong DB (bảng `sources`), nhập qua trang Settings. Fixture test dùng dữ liệu bịa cùng shape.

## Hiện trạng (đã kiểm tra 26/10)
- OAuth đã có `drive.readonly` (đủ để đọc cả Sheets API v4 và export Docs), app Production ⇒ không cần reconnect.
- Tài khoản dashboard đọc được cả 4 nguồn (MLSV đã share theo cách A).
- Schema có sẵn `sources`, `files`, `projects`, `deadlines`, `course_folder_map`, `notes` (chưa dùng).
- Chỉ 1 tài khoản Google (`saveConnection` xóa token cũ). Phase này giữ nguyên.

## Nguồn và cách lấy dữ liệu

| Profile | Nguồn | Lấy gì |
|---|---|---|
| `mlsv` | Folder MLSV (nhiều ban, mỗi sự kiện 1 sheet "Chương trình …" của Ban Tổ chức) | Chỉ task có cột **Phân công** chứa "Ban Chuyên môn"/"BCM". Gom theo sự kiện (tên + ngày diễn ra). |
| `work` | Shared drive công ty + 1 sheet theo dõi dự án | Task từ tab Timeline (Ngày, Việc, Owner, Phối hợp, Trạng thái) và tab Lịch đăng bài (Deadline, PIC, Trạng thái). |
| `study` | Folder tài liệu học tập | Chỉ index file (gần đây, tìm kiếm). Không trích deadline. |
| `brain` | Folder second brain | Chỉ index file. Notes/backlink để Phase 4c. |

### Parser MLSV (`mlsv_event_sheet`): deterministic, không dùng LLM
Quan sát từ dữ liệu thật:
- Sheet nằm trong folder Ban Tổ chức (không nằm trong folder BCM) ⇒ phải quét **cả folder MLSV gốc**, đệ quy, và **đi theo shortcut** (`application/vnd.google-apps.shortcut` → `shortcutDetails.targetId`), vì có file chỉ được để dạng shortcut.
- Tab có tên chứa "Phân công". Hàng header không cố định (có hàng tiêu đề, hàng trống phía trên) ⇒ dò hàng đầu tiên có đủ các cột `Phân công` + `Mốc thời gian` (so khớp đã bỏ dấu, lowercase).
- Cột dùng: `STT`, `Hạng mục công việc` (title), `Nội dung chi tiết`, `Phân công` (ban, có thể nhiều ban cách dấu phẩy), `Người phụ trách`, `Mốc thời gian`, `Trạng thái`, `Tài liệu & Link`.
- `Mốc thời gian` dạng `Trước 15/10/2026`, `01/10 - 04/10/2026`, `15/10/2026` ⇒ lấy ngày cuối, giờ 23:59 VN. Thiếu năm thì lấy năm của ngày sự kiện. Không parse được thì `due_at = null`, vẫn hiện dưới "Chưa có hạn".
- `Trạng thái` "Hoàn thành" ⇒ done. Còn lại giữ nguyên chuỗi.
- Sự kiện: tên + ngày lấy từ tiêu đề file (`… | Chương trình <tên> <dd/mm/yyyy>`), fallback tab "Overview" dòng "Thời gian".
- Tiêu chí nhận file: spreadsheet trong source `mlsv`, có tab "Phân công" với header hợp lệ. File không khớp thì bỏ qua (ghi `files`, không ghi `deadlines`).

### Parser công ty (`table_tasks`): cấu hình theo cột
Sheet công ty không theo template chung ⇒ parser tổng quát, cấu hình lưu trong `sources.config`:
```json
{ "parser": "table_tasks", "tabs": [
  { "tab": "Timeline", "title": "Việc cần làm", "due": "Ngày", "time": "Giờ", "assignee": ["Owner", "Phối hợp"], "status": "Trạng thái" },
  { "tab": "Lịch đăng bài", "title": "Chuyên mục / Bài", "due": "Deadline", "fallbackDue": "Ngày", "assignee": ["PIC"], "status": "Trạng thái" }
] }
```
- **Không lọc theo người**: lấy toàn bộ task của mọi PIC để track tiến độ cả team. Hiển thị theo ngày, mỗi task kèm PIC/Owner, người phối hợp, trạng thái.
- Áp cho cả shared drive công ty: mọi sheet trong drive có tab khớp `tabs` (so tên tab đã bỏ dấu) đều được parse, không chỉ sheet dự án hiện tại. Sheet masterplan khác template thì thêm 1 mục vào `tabs` ở Settings.
- Header dò giống MLSV. Cấu hình mặc định do tao điền sẵn khi thêm source, sửa được ở Settings.

## Thay đổi schema (migration `0002`, chỉ thêm cột nullable, an toàn với dữ liệu hiện có)
- `sources`: thêm `config jsonb` (parser, tab, mapping, filter). Thêm kind `"sheet"`.
- `deadlines`:
  - `file_id` vẫn FK `files`.
  - Thêm `source_id` (FK `sources`), `row_key text` (`<fileId>:<tab>:<STT|row>`, unique), `group_label` (tên sự kiện/dự án), `group_date timestamptz` (ngày diễn ra), `assignee text`, `status text`, `done boolean`, `link text`.
  - `due_at` đổi thành nullable.
- Sync dùng upsert theo `row_key`. Dòng biến mất khỏi sheet thì xóa (chỉ dòng có `manual_override = false`).
- `neon-http` không có transaction ⇒ upsert từng batch, xóa dòng mồ côi sau cùng (idempotent nếu chạy lại).

## Kiến trúc sync
```
GitHub Actions cron (30 phút, 7:00–23:00 VN) / nút "Sync ngay"
  └─ POST $DASHBOARD_URL/api/sync/drive  (Bearer SYNC_SECRET, không body)
Vercel /api/sync/drive
  └─ với mỗi source:
       lần đầu: crawl đệ quy (files.list q="'<id>' in parents", supportsAllDrives, includeItemsFromAllDrives) → files
                 + changes.getStartPageToken → sources.change_token
       lần sau: changes.list(change_token) → chỉ file đổi; lọc file thuộc cây của source qua bảng files (parent chain)
       file sheet khớp parser + modifiedTime đổi → Sheets API values.batchGet → parse → upsert deadlines
  └─ sync_runs (source=drive), Telegram khi ok→lỗi / hồi phục (dùng lại helper Phase 3)
```
- Shared drive (`0A…`) dùng `changes.list` với `driveId`. Folder thường dùng changes của user (1 token chung, lưu vào `settings`).
- Giới hạn: mỗi lần chạy tối đa ~50 sheet parse. Hết giờ (`maxDuration`) thì dừng sạch, lần sau chạy tiếp (token chỉ tiến khi xong trang).
- Log/sync_runs chỉ ghi số lượng (files đổi, deadlines upsert). Không ghi tên file/tên task.

## UI
- **Settings → Nguồn Drive**: dán link folder/shared drive/sheet → tách ID → `files.get` kiểm tra quyền → chọn profile + parser → lưu. Danh sách source có nút sync, xóa, sửa config JSON.
- **Hôm nay → panel "Deadline"** (thay/ghép với "Việc cần làm"): nhóm theo `group_label` (sự kiện, ngày diễn ra), sắp theo `due_at`. Pill profile (MLSV/Công việc), quá hạn đỏ, done ẩn mặc định. Link mở file nguồn.
- **Trang "Công việc" (`/work`) cho nguồn công ty**: timeline theo ngày (hôm qua → 14 ngày tới, chuyển tuần), mỗi ngày liệt kê task + PIC + trạng thái. Lọc theo PIC/dự án/trạng thái, đếm % hoàn thành theo dự án và theo PIC, task quá hạn chưa xong nổi lên đầu. Trang Hôm nay chỉ hiện tóm tắt (task hôm nay + quá hạn).
- **Panel "Drive gần đây"**: 10 file sửa gần nhất, lọc theo profile.
- Health: thêm Drive vào `/health` (đã có `GOOGLE_SOURCES`).

## Thứ tự làm
1. Migration 0002 + type + `src/lib/drive/client.ts` (files.list, files.get, changes, Sheets values.batchGet) + test với fetch mock.
2. Parser `mlsv_event_sheet` + `table_tasks` (hàm thuần, test bằng fixture bịa: header lệch hàng, ngày dạng range, thiếu năm, nhiều ban).
3. `/api/sync/drive` + crawl/changes + upsert/xóa mồ côi + sync_runs.
4. Settings UI thêm source. Tao tự thêm 5 nguồn trên production qua UI.
5. Panel Deadline + trang `/work` (timeline theo ngày, PIC, tiến độ) + Drive gần đây.
6. Workflow `.github/workflows/drive.yml` (chỉ `curl`, không cần Playwright).
7. Test E2E trên production: sync lần đầu, so số task BCM với sheet thật, sửa 1 ô trạng thái ⇒ lần sync sau cập nhật.

Phase 4b (sau): Telegram nhắc deadline trong 24h / task BCM mới. `course_folder_map` FTU ↔ folder học tập. Phase 4c: notes second brain.

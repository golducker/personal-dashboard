# Personal Dashboard

Bảng điều khiển cá nhân cho sinh viên: lịch Google, việc Todoist, deadline lấy từ Google Sheets trên Drive, thời khóa biểu / lịch thi / điểm từ cổng sinh viên, tất cả trên một trang. Cài được như app trên điện thoại và máy tính (PWA), có thông báo đẩy.

Mỗi người tự deploy một bản cho riêng mình: một tài khoản, đăng nhập bằng mã truy cập, dữ liệu nằm trong database của chính bạn.

## Có gì

- **Hôm nay:** lời chào, số deadline hôm nay / quá hạn / số lịch, linh vật đổi tâm trạng theo mức độ gấp.
- **Lịch Google:** xem, thêm, sửa, xóa sự kiện.
- **Todoist:** việc hôm nay và quá hạn, đánh dấu xong có hoàn tác. Todoist sập thì thao tác được xếp hàng, có mạng lại sẽ tự gửi.
- **Deadline từ Drive:** đọc các sheet phân công trong folder bạn chọn, gom theo sự kiện. Tiến độ riêng của bạn (chưa làm / đang làm / xong / hoãn) lưu trong dashboard, không ghi ngược vào sheet. Nút "Xong hết" cho cả một sự kiện.
- **Công việc:** timeline theo tuần, lọc theo người / dự án / trạng thái, tiến độ từng dự án.
- **Cổng sinh viên (FTUgate):** thời khóa biểu, lịch thi, thông báo, điểm và GPA tích lũy. Có điểm mới thì báo qua Telegram và push.
- **Nhắc việc:** push và Telegram trước hạn 24 giờ.
- Giao diện sáng (Psyduck) / tối (Gengar), theo hệ thống hoặc chọn tay.

> Phần FTUgate viết riêng cho cổng sinh viên Đại học Ngoại thương. Trường khác thì bỏ qua (không điền `FTU_*`, tắt workflow) hoặc viết scraper riêng trong `scripts/ftugate/`.

## Công nghệ

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · Neon Postgres (production) / PGlite (local) · web-push · Playwright (scraper) · Vitest. Deploy trên Vercel, đồng bộ định kỳ bằng GitHub Actions.

## Chạy thử trên máy

Cần Node 24.

```bash
git clone https://github.com/golducker/personal-dashboard.git
cd personal-dashboard
npm ci
cp .env.example .env.local
```

Mở `.env.local`, điền ít nhất hai dòng:

- `DASHBOARD_PASSCODE`: mã để đăng nhập.
- `SESSION_SECRET`: chuỗi ngẫu nhiên dài ít nhất 32 ký tự. Tạo nhanh bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Để trống `DATABASE_URL` thì app dùng PGlite, lưu ở `./.data/pglite`.

```bash
npm run db:migrate
npm run dev
```

Mở http://localhost:3000. Chưa nối nguồn nào thì mỗi panel sẽ hiện hướng dẫn kết nối.

## Biến môi trường

Tất cả nằm trong [`.env.example`](.env.example). Nguồn nào không dùng thì để trống, panel đó sẽ báo "chưa cấu hình" chứ không lỗi.

| Biến | Dùng cho |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL gốc của app, dùng để tạo link OAuth callback |
| `OWNER_NAME` | Tên trong lời chào ở trang chủ |
| `CONTACT_EMAIL` | Email liên hệ trên trang `/privacy` |
| `DATABASE_URL` | Chuỗi kết nối Neon/Postgres. Trống = PGlite local |
| `DASHBOARD_PASSCODE`, `SESSION_SECRET` | Đăng nhập |
| `TOKEN_ENCRYPTION_KEY` | Mã hóa refresh token Google (trống = dùng `SESSION_SECRET`) |
| `SYNC_SECRET` | Bearer secret cho `/api/sync/*`, GitHub Actions dùng để gọi đồng bộ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Lịch và Drive |
| `TODOIST_API_TOKEN` | Todoist (Settings → Integrations → Developer) |
| `FTU_USERNAME`, `FTU_PASSWORD` | Cổng sinh viên, chỉ đặt trong GitHub secrets |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Báo điểm và nhắc việc qua Telegram |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Thông báo đẩy. Tạo cặp khóa bằng `npx web-push generate-vapid-keys` |

### Google (Lịch + Drive)

1. Tạo project ở [Google Cloud Console](https://console.cloud.google.com/), bật **Google Calendar API**, **Google Drive API** và **Google Sheets API**.
2. Tạo OAuth client loại **Web application**. Authorized redirect URI: `<NEXT_PUBLIC_APP_URL>/api/auth/google/callback` (ví dụ `http://localhost:3000/api/auth/google/callback` khi chạy local).
3. Màn hình đồng ý OAuth để ở chế độ **Testing** và thêm email của bạn vào Test users là đủ dùng cho một người. Trang `/privacy` có sẵn nếu bạn muốn publish.
4. Điền client ID / secret, vào Cài đặt trong app bấm **Kết nối Google**, rồi thêm folder hoặc sheet Drive cần đọc.

## Deploy

1. Tạo database trên [Neon](https://neon.tech), lấy connection string cho `DATABASE_URL`, rồi chạy migration một lần từ máy: `DATABASE_URL=... npm run db:migrate`.
2. Import repo vào [Vercel](https://vercel.com), điền biến môi trường. `vercel.json` đang đặt region `sin1` (Singapore), đổi nếu bạn ở xa.
3. Đặt `NEXT_PUBLIC_APP_URL` thành domain Vercel và thêm redirect URI tương ứng vào OAuth client.

### Đồng bộ định kỳ (GitHub Actions)

Hai workflow trong [`.github/workflows/`](.github/workflows):

- `drive.yml`: gọi `/api/sync/drive` mỗi 30 phút từ 7:00 đến 23:00 giờ Việt Nam.
- `ftugate.yml`: chạy scraper Playwright rồi đẩy dữ liệu lên `/api/sync/ftugate`.

Thêm repository secrets: `DASHBOARD_URL`, `SYNC_SECRET`, và `FTU_USERNAME` / `FTU_PASSWORD` nếu dùng FTUgate. Fork mới thì GitHub tắt workflow định kỳ, vào tab **Actions** để bật lại. Repo public thì log Actions cũng public: hai workflow này chỉ in mã trạng thái, đừng thêm bước in dữ liệu ra log.

## Cài như app

Mở bản đã deploy (HTTPS) và đăng nhập:

- **iPhone (Safari):** Chia sẻ → Thêm vào MH chính.
- **Android / Windows / macOS (Chrome, Edge):** bấm biểu tượng **Cài đặt** ở thanh địa chỉ.

Bật thông báo đẩy trong trang Cài đặt của app.

## Phát triển

```bash
npm test          # Vitest
npm run lint
npm run db:generate   # tạo migration sau khi sửa src/db/schema.ts
```

- Next 16 khác nhiều so với các bản trước. Đọc `node_modules/next/dist/docs/` trước khi sửa code (xem [`AGENTS.md`](AGENTS.md)).
- Ghi chú thiết kế từng phase nằm trong [`docs/`](docs).

## Giấy phép

Code phát hành theo giấy phép [MIT](LICENSE).

Ảnh linh vật trong `public/mascots/` là Psyduck và Gengar, bản quyền thuộc The Pokémon Company, **không** nằm trong giấy phép MIT. Nếu deploy công khai hoặc dùng cho mục đích thương mại, hãy thay bằng ảnh của bạn: giữ nguyên tên file (`psyduck-calm.webp`, `gengar-panic.webp`, ...) là app tự nhận.

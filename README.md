# Personal Dashboard

Bảng điều khiển cá nhân cho sinh viên: lịch Google, việc Todoist, deadline lấy từ Google Sheets trên Drive, thời khóa biểu / lịch thi / điểm từ cổng sinh viên, gom hết vào một trang. Cài được như app trên điện thoại và máy tính, có thông báo đẩy.

Mỗi người tự deploy một bản riêng, miễn phí, trên tài khoản Vercel của mình. Chỉ có một người dùng là bạn, đăng nhập bằng mã truy cập do bạn đặt, dữ liệu nằm trong database của bạn.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgolducker%2Fpersonal-dashboard-template&project-name=dashboard&repository-name=dashboard&env=DASHBOARD_PASSCODE%2CSESSION_SECRET&envDescription=M%C3%A3%20%C4%91%C4%83ng%20nh%E1%BA%ADp%20v%C3%A0%20kh%C3%B3a%20phi%C3%AAn%20(chu%E1%BB%97i%20ng%E1%BA%ABu%20nhi%C3%AAn%20%C3%ADt%20nh%E1%BA%A5t%2032%20k%C3%BD%20t%E1%BB%B1)&envLink=https%3A%2F%2Fgithub.com%2Fgolducker%2Fpersonal-dashboard-template%23readme&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## Có gì

- **Hôm nay:** lời chào, số deadline hôm nay / quá hạn / số lịch, linh vật đổi tâm trạng theo mức độ gấp.
- **Lịch Google:** xem, thêm, sửa, xóa sự kiện.
- **Todoist:** việc hôm nay và quá hạn, đánh dấu xong có hoàn tác. Todoist sập thì thao tác được xếp hàng, có mạng lại tự gửi.
- **Deadline từ Drive:** đọc các sheet phân công trong folder bạn chọn, gom theo sự kiện. Tiến độ riêng của bạn (chưa làm / đang làm / xong / hoãn) lưu trong dashboard, không ghi ngược vào sheet. Có nút "Xong hết" cho cả một sự kiện.
- **Công việc:** timeline theo tuần, lọc theo người / dự án / trạng thái, tiến độ từng dự án.
- **Cổng sinh viên FTUgate:** thời khóa biểu, lịch thi, thông báo, điểm và GPA. Có điểm mới thì báo qua Telegram và push.
- **Nhắc việc:** push và Telegram trước hạn 24 giờ.
- Giao diện sáng / tối, theo hệ thống hoặc chọn tay.

Nguồn nào cũng tùy chọn. Chưa kết nối thì panel đó hiện hướng dẫn, không lỗi.

---

## Cài đặt

Bạn cần: một tài khoản [GitHub](https://github.com/signup) và một tài khoản [Vercel](https://vercel.com/signup) (chọn **Continue with GitHub**). Cả hai đều miễn phí, không cần thẻ.

### Bước 1. Chuẩn bị hai giá trị

- **Mã đăng nhập** (`DASHBOARD_PASSCODE`): mật khẩu bạn sẽ gõ để vào dashboard. Đặt gì cũng được, nhưng đừng dùng lại mật khẩu ở chỗ khác.
- **Khóa phiên** (`SESSION_SECRET`): một chuỗi ngẫu nhiên dài ít nhất 32 ký tự. Mở https://generate-secret.vercel.app/32 rồi copy chuỗi hiện ra.

### Bước 2. Deploy lên Vercel

1. Bấm nút **Deploy with Vercel** ở đầu trang này.
2. **Create Git Repository:** chọn tài khoản GitHub của bạn, giữ tên `dashboard` hoặc đổi tùy ý. Vercel sẽ tạo một bản sao code trong GitHub của bạn.
3. **Add Integrations → Neon:** bấm **Add**, giữ cấu hình miễn phí, chọn region gần bạn (Singapore nếu ở Việt Nam) rồi **Create**. Đây là database, Vercel tự nối vào app.
4. **Configure Project:** dán hai giá trị ở Bước 1 vào `DASHBOARD_PASSCODE` và `SESSION_SECRET`.
5. Bấm **Deploy** và đợi khoảng 2 phút. Bảng database được tạo tự động trong lúc build.
6. Bấm **Continue to Dashboard → Visit**, đăng nhập bằng mã ở Bước 1.

Đến đây dashboard đã chạy. Các bước sau là nối từng nguồn dữ liệu, cái nào cần thì làm.

> **Thêm hoặc sửa biến môi trường:** vào project trên Vercel → **Settings → Environment Variables**, thêm biến, rồi vào **Deployments** → bản mới nhất → **⋯ → Redeploy**. Biến mới chỉ có hiệu lực sau khi redeploy.

### Bước 3. Tên của bạn (tùy chọn)

Thêm biến `OWNER_NAME` (ví dụ `An`) để trang chủ chào "Chào buổi sáng, An." Không đặt thì chỉ chào "Chào buổi sáng."

### Bước 4. Todoist (tùy chọn)

1. Vào [Todoist → Settings → Integrations → Developer](https://app.todoist.com/app/settings/integrations/developer), copy **API token**.
2. Thêm biến `TODOIST_API_TOKEN`, redeploy.

### Bước 5. Google Lịch và Drive (tùy chọn)

Phần này dài nhất, làm một lần là xong.

1. Vào [Google Cloud Console](https://console.cloud.google.com/), tạo project mới.
2. **APIs & Services → Library**, bật lần lượt: **Google Calendar API**, **Google Drive API**, **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** (hoặc **Google Auth Platform**):
   - User type: **External**. Điền tên app và email của bạn.
   - **Audience → Test users:** thêm email Google của bạn.
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs: `https://<tên-app>.vercel.app/api/auth/google/callback` (thay bằng đúng domain Vercel của bạn).
5. Copy **Client ID** và **Client secret** vào hai biến `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redeploy.
6. Mở dashboard → **Cài đặt → Kết nối Google**. Google sẽ cảnh báo "app chưa được xác minh": bấm **Advanced → Go to ... (unsafe)**. Đây là app của chính bạn nên không sao.
7. Trong **Cài đặt → Nguồn Drive**, dán link folder, shared drive hoặc sheet cần đọc deadline rồi bấm **Thêm nguồn**.

> App để ở chế độ **Testing** thì Google cho phiên đăng nhập sống **7 ngày**. Hết hạn, dashboard hiện nút **Kết nối lại Google**, bấm là xong. Muốn bỏ giới hạn này phải đưa app qua quy trình xác minh của Google, khá mất công vì app đọc Drive.

### Bước 6. Tự động đồng bộ Drive (tùy chọn)

Repo đã có sẵn GitHub Actions gọi đồng bộ Drive mỗi 30 phút (7:00 đến 23:00 giờ Việt Nam).

1. Tạo thêm một chuỗi ngẫu nhiên (như Bước 1) làm `SYNC_SECRET`. Thêm vào Vercel, redeploy.
2. Trên GitHub, mở repo `dashboard` vừa được tạo → **Settings → Secrets and variables → Actions → New repository secret**, thêm:
   - `SYNC_SECRET`: cùng giá trị như trên Vercel.
   - `DASHBOARD_URL`: domain của bạn, ví dụ `https://dashboard-abc.vercel.app` (không có `/` ở cuối).
3. Vào tab **Actions → Drive sync → Run workflow** để chạy thử.

Chưa thêm secrets thì workflow tự bỏ qua, không báo lỗi.

### Bước 7. Thông báo đẩy (tùy chọn)

1. Cần cài [Node.js](https://nodejs.org) trên máy. Mở terminal và chạy:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Thêm vào Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (hai khóa vừa in ra) và `VAPID_SUBJECT` = `mailto:<email của bạn>`. Redeploy.
3. Mở dashboard → **Cài đặt → Thông báo → Bật thông báo**. Trên iPhone phải cài dashboard ra màn hình chính trước (xem [Cài như app](#cài-như-app)) thì mới bật được.

### Bước 8. Telegram (tùy chọn)

1. Nhắn [@BotFather](https://t.me/BotFather) trên Telegram, gõ `/newbot` và làm theo hướng dẫn, nhận **bot token**.
2. Nhắn [@userinfobot](https://t.me/userinfobot) để lấy **chat ID** của bạn, rồi nhắn bot của bạn một tin bất kỳ (bot chỉ gửi được cho người đã nhắn nó trước).
3. Thêm `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` vào Vercel, redeploy.

### Bước 9. FTUgate (chỉ sinh viên Đại học Ngoại thương)

Scraper chạy trên GitHub Actions (đăng nhập cổng sinh viên bằng trình duyệt ẩn), rồi đẩy dữ liệu về dashboard.

1. Làm xong Bước 6 (cần `SYNC_SECRET` và `DASHBOARD_URL`).
2. Thêm hai GitHub secrets: `FTU_USERNAME` (MSSV) và `FTU_PASSWORD`. Mật khẩu chỉ nằm trong GitHub secrets, không bao giờ vào Vercel hay database.
3. **Actions → FTUgate sync → Run workflow** để chạy thử.

Trường khác thì bỏ qua bước này, panel thời khóa biểu / điểm sẽ để trống.

### Kiểm tra

Trang **Tình trạng** trong dashboard cho biết nguồn nào đã cấu hình, lần đồng bộ gần nhất và lỗi nếu có.

---

## Cài như app

Mở dashboard (link Vercel) và đăng nhập:

- **iPhone (Safari):** nút Chia sẻ → **Thêm vào MH chính**.
- **Android, Windows, macOS (Chrome, Edge):** bấm biểu tượng **Cài đặt** ở cuối thanh địa chỉ, hoặc menu → **Cài đặt ứng dụng**.

## Cập nhật lên bản mới

Repo của bạn là bản sao độc lập nên không tự nhận cập nhật. Khi muốn lấy bản mới, chạy trong thư mục code của bạn:

```bash
git remote add upstream https://github.com/golducker/personal-dashboard-template.git
git pull upstream main
git push
```

Lệnh `git remote add` chỉ cần chạy lần đầu. Vercel tự deploy lại sau khi push, và migration database chạy tự động trong lúc build.

---

## Chạy trên máy (cho người muốn sửa code)

Cần Node 24.

```bash
git clone https://github.com/<bạn>/dashboard.git
cd dashboard
npm ci
cp .env.example .env.local
```

Điền `DASHBOARD_PASSCODE` và `SESSION_SECRET` vào `.env.local`. Để trống `DATABASE_URL` thì app dùng PGlite lưu ở `./.data/pglite`.

```bash
npm run db:migrate
npm run dev
```

Mở http://localhost:3000. Muốn dùng Google khi chạy local thì thêm redirect URI `http://localhost:3000/api/auth/google/callback` vào OAuth client.

```bash
npm test              # Vitest
npm run lint
npm run db:generate   # tạo migration sau khi sửa src/db/schema.ts
```

Next.js 16 khác nhiều so với bản cũ, đọc [`AGENTS.md`](AGENTS.md) trước khi sửa code.

**Công nghệ:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · Neon Postgres / PGlite · web-push · Playwright · Vitest.

## Biến môi trường

Danh sách đầy đủ ở [`.env.example`](.env.example).

| Biến | Bắt buộc | Dùng cho |
|---|---|---|
| `DASHBOARD_PASSCODE` | có | Mã đăng nhập |
| `SESSION_SECRET` | có | Ký phiên đăng nhập, ít nhất 32 ký tự |
| `DATABASE_URL` | trên Vercel | Neon tự điền. Để trống khi chạy local thì dùng PGlite |
| `OWNER_NAME` | | Tên trong lời chào |
| `CONTACT_EMAIL` | | Email liên hệ trên trang `/privacy` |
| `NEXT_PUBLIC_APP_URL` | | URL gốc cố định cho OAuth. Trống = lấy theo domain đang mở |
| `TOKEN_ENCRYPTION_KEY` | | Khóa mã hóa token Google. Trống = dùng `SESSION_SECRET` |
| `SYNC_SECRET` | | Cho GitHub Actions gọi `/api/sync/*` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | Lịch và Drive |
| `TODOIST_API_TOKEN` | | Todoist |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | | Telegram |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | | Thông báo đẩy |
| `FTU_USERNAME`, `FTU_PASSWORD` | | FTUgate, chỉ đặt trong GitHub secrets |

## Giấy phép

Code phát hành theo giấy phép [MIT](LICENSE).

Ảnh linh vật trong `public/mascots/` là Psyduck và Gengar, bản quyền thuộc The Pokémon Company, **không** nằm trong giấy phép MIT. Bạn dùng cho riêng mình thì thôi, còn nếu dùng công khai hoặc thương mại thì hãy thay bằng ảnh của bạn: giữ nguyên tên file (`psyduck-calm.webp`, `gengar-panic.webp`, ...) là app tự nhận.

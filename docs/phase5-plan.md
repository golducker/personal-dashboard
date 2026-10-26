# Phase 5 plan: PWA, web push, và làm lại UI (2 theme + mascot)

Nguồn: `docs/handoff-next.md`, `AGENTS.md` (Next 16.4.3, đọc `node_modules/next/dist/docs/` trước khi viết code). Repo public: không commit secret, không commit dữ liệu cá nhân.

Người dùng chính dùng **iPhone, Safari → "Thêm vào màn hình chính"** (standalone PWA) và máy tính. Mọi thứ phải chạy mượt trên iPhone trước.

## A. PWA + web push

### PWA
- `src/app/manifest.ts` (metadata route): `name` "Dashboard", `short_name` "Dashboard", `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `background_color`/`theme_color` theo theme sáng, icons 192/512 (`purpose: "any"`) + 512 maskable.
- Icons trong `public/icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` 180). Sinh bằng script `scripts/make-icons.mts` dùng `sharp` (đã có trong node_modules) từ 1 SVG nguồn (`public/icons/icon.svg`). Khi có ảnh mascot thì sinh lại icon từ mascot.
- `layout.tsx` metadata: `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Dashboard" }`, `icons.apple`, `manifest`. Viewport: `viewportFit: "cover"`, themeColor theo theme.
- Safe area: header, bottom tab bar, toast dùng `env(safe-area-inset-*)`.
- Service worker `public/sw.js` (plain JS, không bundler):
  - precache shell nhỏ: `/offline` + icons; runtime: static assets `/_next/static/*` cache-first; điều hướng (HTML) network-first, lỗi mạng → `/offline`. **Không cache** `/api/*` và HTML có dữ liệu cá nhân (chỉ dùng để fallback offline page).
  - `push` → `showNotification(title, { body, icon, badge, tag, data: { url } })`; `notificationclick` → focus tab đang mở hoặc `clients.openWindow(url)`.
  - versioned cache name, xóa cache cũ ở `activate`.
- `src/components/sw-register.tsx` (client): đăng ký `/sw.js` khi production, `updateViaCache: "none"`.
- Trang `/offline` tĩnh, có mascot, nút "Thử lại".

### Web push
- Thư viện `web-push` (npm, chuẩn VAPID + mã hóa payload). Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` của chủ app). Public key đưa xuống client qua server component prop, **không** dùng `NEXT_PUBLIC_`.
- Bảng `push_subscriptions` đã có. Thêm cột `user_agent text`, `last_ok_at`, `failures int default 0` (migration 0004, chỉ thêm cột).
- API (sau session auth của `src/proxy.ts`):
  - `POST /api/push/subscribe` body = PushSubscription JSON → upsert theo `endpoint`.
  - `POST /api/push/unsubscribe` `{ endpoint }`.
  - `POST /api/push/test` → gửi 1 thông báo thử tới mọi subscription.
- `src/lib/push.ts`: `sendPush({ title, body, url, tag })` tới mọi subscription; 404/410 → xóa subscription; lỗi khác tăng `failures`. Không log endpoint/payload.
- Nối vào các chỗ đang gửi Telegram: điểm mới (`src/lib/ftugate/sync.ts`), sync lỗi/hồi phục (FTUgate + Drive). Telegram giữ nguyên, push là kênh thêm.
- **Nhắc deadline**: migration 0004 thêm `deadlines.reminded_at timestamptz`. Cuối mỗi lần Drive sync: task chưa xong (effective, không `postponed`), `due_at` trong 24h tới, `reminded_at` null → gom thành 1 push ("3 deadline trong 24h tới: …"), set `reminded_at`. Đổi `due_at` (sheet dời hạn) thì reset `reminded_at` về null trong upsert.
- Settings → panel "Thông báo":
  - Không hỗ trợ (`!("PushManager" in window)`) → giải thích: trên iPhone phải mở từ icon ngoài màn hình chính (Safari → Chia sẻ → Thêm vào MH chính), iOS 16.4+.
  - Có hỗ trợ: nút Bật/Tắt (xin quyền khi bấm), trạng thái thiết bị này, nút "Gửi thử".
- `health.ts`: webpush = `not_configured` khi thiếu VAPID, `ok` khi có ≥1 subscription.

## B. Design system 2 theme

Hai theme là hai "thế giới" riêng, không chỉ đổi màu: mỗi theme có mascot, nền, hiệu ứng và âm thanh riêng.

### Chọn theme
- 3 chế độ: **Tự động** (theo hệ thống, mặc định), **Sáng (Psyduck)**, **Tối (Gengar)**. Lưu cookie `theme` (1 năm) để server render đúng ngay lần đầu, không nháy.
- `<html data-theme="light|dark">` khi chọn tay; không có attribute = theo `prefers-color-scheme`.
- Nút đổi theme trên header: bấm → chu kỳ, có hiệu ứng "lộ dần" hình tròn từ vị trí nút (`document.startViewTransition` + `clip-path`, fallback crossfade). `theme-color` meta cập nhật theo.

### Token (đặt trong `globals.css`, giữ tên token cũ để không vỡ component)

**Light, Psyduck**: vàng sáng, ấm, vui.
| Token | Giá trị |
|---|---|
| `--bg` | `#FFF6D6` (kem vàng) |
| `--surface` | `#FFFCF1` |
| `--surface-2` | `#FFEFB8` |
| `--line` / `--line-strong` | `rgb(92 64 8 / .12)` / `rgb(92 64 8 / .22)` |
| `--ink` / `--ink-2` / `--ink-3` | `#2A1F0A` / `#5E4A22` / `#8A7444` |
| `--accent` (nút chính, nền) | `#FFC72C` (vàng Psyduck) |
| `--accent-ink` (chữ trên accent) | `#2A1F0A` |
| `--accent-strong` (chữ/viền accent trên nền sáng, đủ contrast) | `#9A6A00` |
| `--accent-soft` | `#FFE48A` |
| `--secondary` (mỏ Psyduck, chỉ điểm xuyết) | `#F4D9A6` |
| `--danger` / `--danger-soft` | `#C2410C` / `#FFE1CC` |
| `--warn` / `--warn-soft` | `#B45309` / `#FFEDC2` |
| shadow | ấm, tint nâu: `0 1px 0 rgb(255 255 255/.7) inset, 0 10px 30px -14px rgb(120 80 0/.35)` |

**Dark, Gengar**: đen tím, bí ẩn, glow.
| Token | Giá trị |
|---|---|
| `--bg` | `#0C0814` |
| `--surface` | `#151022` (glass: `rgb(21 16 34 / .72)` + blur) |
| `--surface-2` | `#1F1830` |
| `--line` / `--line-strong` | `rgb(196 168 255 / .10)` / `rgb(196 168 255 / .20)` |
| `--ink` / `--ink-2` / `--ink-3` | `#EFE9FF` / `#B5A8D6` / `#8B7FAD` |
| `--accent` | `#9B6BFF` (tím Gengar) |
| `--accent-ink` | `#0C0814` |
| `--accent-strong` | `#B89BFF` |
| `--accent-soft` | `rgb(155 107 255 / .16)` |
| `--secondary` (lưỡi/miệng Gengar, chỉ dùng cho glow và hiệu ứng) | `#E2457A` |
| `--danger` / `--danger-soft` | `#FF6B8B` / `rgb(255 107 139/.14)` |
| `--warn` / `--warn-soft` | `#F7B955` / `rgb(247 185 85/.13)` |
| shadow | glow tím: `0 0 0 1px rgb(196 168 255/.06) inset, 0 18px 40px -18px rgb(110 60 220/.55)` |

Mắt Gengar đỏ/vàng → dùng `--secondary` cho chấm "mới", điểm nhấn hover.

### Typography
- Giữ **Be Vietnam Pro** (dấu tiếng Việt đẹp) cho body, thêm display font có cá tính cho tiêu đề lớn và số lớn: **Bricolage Grotesque** (`next/font/google`, có subset vietnamese) cho h1/số liệu lớn. JetBrains Mono cho giờ, ngày, điểm (tabular).
- H1 trang: 32–40px desktop, 28px mobile, tracking âm, `text-wrap: balance`.

### Layout
- **Desktop (≥ 768px)**: header dính trên cùng, glass blur khi cuộn (thu nhỏ chiều cao 64→52px), nav dạng segmented có "pill" trượt theo trang hiện tại (animate vị trí).
- **Mobile**: header gọn (mascot + tên trang + nút theme), **tab bar dưới đáy** (Hôm nay / Công việc / Cài đặt / Tình trạng) có safe-area, icon + nhãn, pill active trượt. Nội dung chừa padding đáy.
- **Hero** trang Hôm nay: lời chào theo giờ + ngày + mascot lớn bên phải (mobile: nhỏ hơn, cạnh lời chào), 3 "stat chip" nhanh: số deadline hôm nay, quá hạn, sự kiện lịch hôm nay. Mascot nói 1 câu bubble theo ngữ cảnh (vd quá hạn → câu nhắc, hết việc → câu khen), xoay vòng khi bấm.
- Panel: bo 20px, padding 20px; control 12px; pill full. Panel ở dark theme là glass (backdrop-blur) trên nền có ambient.

### Mascot
- Ảnh PNG nền trong suốt ở `public/mascots/` (`gengar.webp`, `psyduck.webp` + biến thể nếu có), tách nền từ ảnh của người dùng. Component `<Mascot mood="idle|happy|alert" />` chọn ảnh theo theme (CSS: hiện ảnh theo `data-theme`/media, không cần JS để tránh nháy).
- Animation: lơ lửng nhẹ (translateY 6px, 4s), bóng đổ dưới chân co giãn theo; bấm vào → nảy (spring) + đổi câu thoại + SFX; Gengar: thỉnh thoảng mờ đi rồi hiện lại như ma (opacity flicker), Psyduck: lắc đầu nhẹ (rotate ±3°).
- Empty state, trang offline, 404, loading toàn trang dùng mascot nhỏ.

### Nền & VFX
- Lớp nền cố định (`<Ambient />`, `pointer-events:none`, `z-index` thấp):
  - Gengar: 2–3 đốm gradient tím/hồng mờ trôi chậm + "sương ma" (radial mờ) + vài hạt sáng tím nhấp nháy (CSS, ≤ 12 hạt).
  - Psyduck: nắng vàng góc trên (radial), vài bong bóng tròn trong suốt bay lên chậm, thỉnh thoảng 1 dấu "?" nhỏ trôi (Psyduck bối rối).
  - Grain noise phủ toàn trang, opacity 3–5% (SVG feTurbulence data URI).
- Panel: **spotlight border** theo con trỏ (desktop, CSS var `--mx/--my`), hover nâng nhẹ.
- **Reveal khi cuộn**: panel và item xuất hiện so le (opacity + translateY 12px, 450ms, spring-ish `cubic-bezier(.2,.8,.2,1)`) qua IntersectionObserver, chỉ chạy 1 lần.
- **Thanh tiến trình cuộn** mảnh 2px trên đỉnh, màu accent.
- **Nút**: ripple tại điểm bấm, scale 0.97 khi nhấn, hover sáng/nhích.
- **Đánh dấu Xong**: burst hạt nhỏ tại nút (Gengar: tia tím/hồng; Psyduck: sao vàng), checkbox vẽ nét check (stroke-dashoffset).
- **Chuyển trang**: nội dung fade + slide nhẹ (template.tsx hoặc View Transitions nếu Next 16 hỗ trợ ổn định).
- **Số liệu**: GPA/điểm/đếm deadline đếm lên khi xuất hiện.
- Skeleton loading có shimmer theo màu theme.
- Tất cả hiệu ứng tôn trọng `prefers-reduced-motion` (tắt chuyển động, giữ fade) và chỉ dùng `transform`/`opacity`. Không thêm thư viện animation nặng; CSS + vài hook nhỏ là đủ. Mục tiêu 60fps trên iPhone.

### SFX
- `src/lib/sfx.ts`: tổng hợp bằng Web Audio API (không file âm thanh), AudioContext tạo lười ở lần chạm đầu (yêu cầu của iOS).
  - `tap` (click mềm, ngắn), `toggle`, `success` (2 nốt đi lên), `undo` (whoosh đi xuống), `error` (2 nốt trầm), `theme`.
  - Âm sắc theo theme: Gengar dùng sóng sine/triangle trầm hơn + chút detune "ma quái"; Psyduck dùng âm "quack" ngắn (square + pitch drop) cho `theme`/mascot, các âm khác tươi, cao.
- Bật/tắt âm thanh trong Settings (mặc định bật, âm lượng nhỏ), lưu `localStorage`. Gắn SFX qua 1 delegated listener cho `button, a, [role=menuitem]` + gọi trực tiếp cho success/undo/error.

### UX & QC
- Tap target ≥ 44px trên mobile, input font-size 16px (tránh iOS tự zoom).
- Focus ring rõ cả 2 theme; contrast chữ ≥ 4.5:1.
- Trang 404 có mascot, link về Hôm nay.
- Không cuộn ngang ở 375px; bàn phím mở không che input.
- Kiểm tra: desktop 1366, iPhone 390×844 (standalone giả lập), cả 2 theme, reduced motion.

## Thứ tự làm
1. Spec (file này).
2. Song song: (A) PWA + push, (B) design system + UI + VFX/SFX. A chỉ tạo file mới và export component; tích hợp vào layout/settings làm sau.
3. Mascot: tách nền ảnh người dùng → `public/mascots/`, sinh icon app từ mascot.
4. Tích hợp, review, QC trên build local (desktop + mobile, 2 theme), sửa.
5. Migration 0004 vào Neon, đặt VAPID env trên Vercel, push, kiểm tra production.

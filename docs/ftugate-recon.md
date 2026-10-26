# FTUgate recon (2026-10-26)

## Tổng quan
- Frontend: Angular SPA, release `DHNT-V 2026.10F.34` (hệ eduSoft/DHNT).
- Trang login: `https://ftugate.ftu.edu.vn/#/` → sau login chuyển sang `http://ftugate.ftu.edu.vn/cq/hanoi/#/home` (**HTTP, không TLS**).
- API prefix: `/cq/hanoi/api/`. Toàn bộ là POST trả JSON dạng `{ data, result, code }`.
- Login: không captcha, không OTP (`w-locdssettingdangnhap`). Session timeout cấu hình 7 phút, có refresh token.

## Auth
- `POST api/auth/login`, body `application/x-www-form-urlencoded` (OAuth2-style, có `grant_type=refresh_token` để refresh).
- Token lưu ở `sessionStorage.CURRENT_USER.access_token`, gửi qua header `Authorization: Bearer ...` + header `idpc`.
- **Mỗi request API còn kèm một header chữ ký do JS của trang sinh ra (obfuscate, có timestamp).**
  Đây là cơ chế chống gọi API trực tiếp / chống tool. Không reverse-engineer hay giả mạo header này.
  → Scraper phải chạy trang thật trong headless browser (Playwright) để JS của trường tự sinh header.

## Endpoint cần dùng
| Dữ liệu | Endpoint |
|---|---|
| Info SV | `dkmh/w-locsinhvieninfo` |
| Học kỳ có TKB | `sch/w-locdshockytkbuser` |
| TKB tuần | `sch/w-locdstkbtuanusertheohocky` |
| TKB học kỳ | `sch/w-locdstkbusertheohocky` |
| Học kỳ có lịch thi | `report/w-locdshockylichthisinhvien` |
| Lịch thi | `epm/w-locdslichthisvtheohocky` |
| Điểm | `srm/w-locdsdiemsinhvien?hien_thi_mon_theo_hkdk=false` |
| Thông báo | `web/w-locdsthongbao` |

Route SPA tương ứng: `#/tkb-tuan`, `#/tkb-hocky`, `#/lichthi`, `#/diem`.

## Hướng scraper
Playwright: login qua form → mở từng route → bắt response JSON của các endpoint trên (`page.waitForResponse`)
thay vì parse DOM. Tần suất thấp (15–30 phút cho điểm, 1 lần/ngày cho TKB + lịch thi).
Không chạy được Playwright trên Vercel Hobby → chạy trên GitHub Actions, đẩy JSON về API của dashboard.

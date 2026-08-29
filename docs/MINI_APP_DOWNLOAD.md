# Mini-app download — handle tải file

> Chi tiết **cách exe / icon mini-app được tải**. Store **không** có route
> stream riêng cho installer đã unwrap (không `GET /api/apps/download`, không
> presign). File nằm dưới `STORAGE_DIR`; client **GET thẳng** URL đã dựng lúc
> upload (`/api/v1/media/…`).
>
> Upload (ghi file + dựng URL): [MINI_APP_UPLOAD.md](./MINI_APP_UPLOAD.md),
> [mini-app-upload-server.md](./mini-app-upload-server.md).
> Buyer đóng gói lại từ graph (entitlement + template): [script-publish-packaging.md](./script-publish-packaging.md)
> — **khác** kênh tải exe đã unwrap ở đây.

---

## 1. Mô hình

```
Lúc upload (một lần) — POST /api/v1/apps/upload  (alias /api/apps/upload)
  parseMiniAppContainer → exe + icon
  storage.saveAs(key) → mediaUrl(ref) → trả JSON downloadUrl / iconUrl
  MiniAppBuild (builtBy=upload).fileUrl = ref exe

Lúc tải (mọi lần sau)
  trình duyệt / client  GET  {downloadUrl}   ──►  Nest MediaServeController (public)
                        GET  {iconUrl}       ──►  cùng handler
  Portal Next chỉ proxy /api/* → API; không tự stream bytes.
```

Hai object, hai URL, cùng cơ chế:

| Object | Nơi giữ ref | Key dưới `STORAGE_DIR` | Content-Type lúc GET |
| --- | --- | --- | --- |
| Exe (installer đã giải mã) | JSON upload + `mini_app_builds.file_url` (`builtBy=upload`) | `mini-apps/{appId}/{version}/{slug}-setup.exe` | `application/octet-stream` |
| Icon PNG | JSON upload + `scripts.thumbnail_url` (khi lấy từ wrapper) | `mini-apps/{appId}/icon.png` | `image/png` |

`.haup` gốc **không** lưu, **không** có URL tải. Chỉ exe plaintext + icon.

Không có bảng `mini_apps` / cột `download_url` như Manager cũ. URL **không** tính lại lúc
click — chuỗi đã trả lúc upload (và suy ra được từ cùng rule `mediaUrl` + key cố định).

Metadata catalogue / entitlement **không** trả `downloadUrl`. Link tải nằm JSON upload,
`MiniAppBuild.fileUrl` (seller portal đọc build rồi GET media hoặc stream build), và UI
seller sau upload.

---

## 2. Dụng URL — `mediaUrl`

File: `server/src/scripts/scripts.service.ts` (`mediaUrl`). Gọi **một lần** khi
`storage.saveAs` xong; chuỗi đưa vào JSON response (và icon vào `thumbnailUrl` nếu form
không gửi ảnh).

```ts
mediaUrl(ref) =
  `/api/v1/media/` + ref.split('/').map(encodeURIComponent).join('/')
```

Không query string, không chữ ký hết hạn, không `S3_*`. URL cố định đến khi re-upload
ghi đè cùng key (exe cùng `appId`+`version`) hoặc xoá file trên disk.

### Ví dụ

`appId=com.hideauto.mini.anna-bot`, `version=1.0.0`, slug `anna-bot`:

| | |
| --- | --- |
| Key disk | `{STORAGE_DIR}/mini-apps/com.hideauto.mini.anna-bot/1.0.0/anna-bot-setup.exe` |
| `downloadUrl` | `/api/v1/media/mini-apps/com.hideauto.mini.anna-bot/1.0.0/anna-bot-setup.exe` |
| Icon key | `{STORAGE_DIR}/mini-apps/com.hideauto.mini.anna-bot/icon.png` |
| `iconUrl` | `/api/v1/media/mini-apps/com.hideauto.mini.anna-bot/icon.png` |

Browser mở portal (`:3000`) → Next rewrite `/api/*` → Nest (`API_ORIGIN`, mặc định
`:3001`). Client cũng có thể GET thẳng origin API nếu biết host.

`appId` / `version` đi thẳng vào path; mỗi segment `encodeURIComponent`, `/` giữa segment
được giữ.

---

## 3. Điều kiện để tải được

PUT lúc upload dùng disk local (`StorageService`) — không credential S3.

GET lúc tải:

1. File còn trên disk tại đúng key.
2. `GET /api/v1/media/{*ref}` **public** — không JWT seller, không Bearer flowdesk.
3. Origin client phải tới được host phục vụ `/api/v1/media/…` (portal same-origin hoặc
   `STORE_PUBLIC_URL` / API host).

Sai key / file đã xoá → 404. Portal/API **không** health-check URL sau khi ghi.

Khác Manager/S3: không cần bucket public-read / CORS S3 / `S3_PUBLIC_BASE_URL`. CSP
`img-src` cho icon: same-origin portal là đủ (URL media đi qua rewrite).

---

## 4. Surface phát URL

### 4.1 JSON lúc upload — `POST /api/v1/apps/upload`

(Alias Manager: `POST /api/apps/upload`.)

```json
{
  "ok": true,
  "appId": "com.hideauto.mini.anna-bot",
  "name": "Anna Bot",
  "version": "1.0.0",
  "mode": "PUBLIC",
  "downloadUrl": "/api/v1/media/mini-apps/…/anna-bot-setup.exe",
  "iconUrl": "/api/v1/media/mini-apps/…/icon.png",
  "fileSize": 1234567,
  "checksumSha256": "<64 hex>",
  "scriptId": "…"
}
```

`fileSize` / `checksumSha256` là của **exe đã giải mã**, không phải `.haup`. Client tải
xong có thể tự hash để đối chiếu — **server không** verify lúc GET media.

### 4.2 Seller portal

- Sau upload: response có `downloadUrl` — có thể `<a href>` / mở tab (same-origin qua
  rewrite). Form hiện redirect sang `/portal/mini-apps/{scriptId}`.
- Tab packaging: mọi bản (upload / server / agent) tải qua
  `GET …/builds/:id/download` → portal `fetch` → `blob:` + `<a download>`.
  **Không** điều hướng thẳng tới `/api/v1/media/…-setup.exe` — Chrome chặn navigation
  tới `.exe`. URL media vẫn public cho share / client khác.
- Icon listing: `scripts.thumbnailUrl` (thường = `iconUrl` từ wrapper) → `<img src>`.

Không audit `mini-app.download`. Click media URL = điều hướng tới
`MediaServeController`, không `requireRole` / không seller guard.

### 4.3 API buyer / metadata — **không** phát URL exe đã unwrap

| Endpoint | Auth | File? |
| --- | --- | --- |
| `GET /api/v1/app/scripts/:scriptId/download` | flowdesk Bearer + entitlement | Stream **gói đóng lại** từ graph + template (`PackagingService`), không phải exe đã unwrap trên disk |
| Redeem / licence / entitlement | flowdesk | Không trả file, không chặn GET media |
| Catalogue store | — | Không trả `downloadUrl` exe upload |

`mode` trên form upload (`PUBLIC` \| `LICENSE`) ghi trong JSON response; **không** lưu cột
riêng trên `scripts` hiện tại và **không** ảnh hưởng GET media. Gate license (nếu bật) là
runtime app sau khi đã có gói — xem [mini-app-licensing.md](./mini-app-licensing.md).

---

## 5. Control-flow lúc “Tải exe” (URL media)

```
Client GET  {downloadUrl}     (path /api/v1/media/mini-apps/…)
        │
        ▼
Next rewrite (nếu từ portal) → Nest MediaServeController
        │
        ├─ file tồn tại → 200  body = exe bytes
        │                 Content-Type: application/octet-stream (.exe)
        ├─ ref lệch / đã xoá → 404
        └─ path escape STORAGE_DIR → 400 Invalid storage reference
```

Không JWT store, không Bearer end-user, không kiểm `mode=LICENSE`. Ai đoán được
`appId`+`version`+slug (hoặc đã share URL) đều GET được nếu server mở cổng và file còn.

---

## 6. Key, version, xoá

| Sự kiện | Exe trên disk | URL / ref |
| --- | --- | --- |
| Upload lần đầu | `saveAs` key `…/{version}/…-setup.exe` | `downloadUrl` + `MiniAppBuild.fileUrl` |
| Re-upload **cùng** version | ghi đè cùng key | URL **không đổi** (cùng chuỗi) |
| Re-upload **version mới** | key mới; key cũ **còn** | URL/build trỏ bản mới |
| Xoá listing / build | **không** dọn tự động mọi object `mini-apps/{appId}/…` | — |
| | icon `…/icon.png` **không** xoá theo version | — |
| | exe version cũ **không** xoá | URL cũ vẫn GET được nếu file còn |

Hệ quả: link đã share với version cũ vẫn tải được sau khi listing trỏ bản mới, cho đến khi
ai đó xoá tay file dưới `STORAGE_DIR`.

`MiniAppBuild.fileUrl` (builtBy=upload) = key exe **hiện tại** của version đó. Stream
`…/builds/:id/download` đọc cột này, không quét prefix.

---

## 7. Header lúc GET media

`MediaServeController` (`server/src/media/media.controller.ts`):

| Header | Giá trị |
| --- | --- |
| `Content-Type` | `.exe` → `application/octet-stream`; `.png` → `image/png`; khác → octet-stream |
| `Content-Length` | size trên disk |
| `Content-Disposition` | `.exe` (và non-image): `attachment; filename="…"` — bắt buộc để Chrome lưu file thay vì điều hướng / chặn |
| `Cache-Control` | `public, max-age=31536000, immutable` |
| `X-Content-Type-Options` | `nosniff` |

Bytes **stream** (`createReadStream`). Ảnh (png/jpg/…) **không** gắn `attachment` để
`<img>` vẫn hiện. Portal: `downloadMedia` click `<a download>` **cùng tab** (không
`target=_blank` — popup blocker nuốt click từ handler `async`).

---

## 8. Việc **không** có trong handle tải (exe unwrap)

Store **không** (trên kênh media):

- Route riêng `GET /api/…/apps/download` chỉ để stream exe unwrap.
- Presigned URL hết hạn.
- So checksum lúc tải; checksum chỉ lưu `MiniAppBuild.checksum` + trả lúc upload.
- Rate-limit riêng GET media (có thể rate-limit toàn API / reverse proxy).
- Audit khi ai đó tải.
- Ẩn URL khi `mode=LICENSE`.
- Range-request / resume — phụ thuộc client + Nest/static; không thiết kế riêng.
- Trả `.haup` — file đó không tồn tại trên storage.

So với packaging buyer (`GET /api/v1/app/scripts/:id/download`): **có** auth + entitlement,
bytes là template-inject (hoặc graph JSON), **không** đọc key `mini-apps/…-setup.exe`.

---

## 9. Lỗi thường gặp khi tải

| Triệu chứng | Nguyên nhân |
| --- | --- |
| 404 trên `/api/v1/media/…` | key lệch; file chưa upload; đã xoá tay; `STORAGE_DIR` khác process |
| Connection refused / sai host | gọi thẳng `:3001` trong khi chỉ mở portal, hoặc ngược lại không rewrite |
| Icon vỡ, exe tải được | `iconUrl` null (decode PNG fail lúc upload — cố ý không fail upload) |
| App desktop không lấy được link exe unwrap | đúng — buyer API không trả `downloadUrl`; tải buyer = packaging |
| LICENSE vẫn GET media được không cần key | đúng hành vi — gate license ≠ gate media |
| Portal “Tải app” 401 trên bản upload | không — upload dùng media public; 401 chỉ nếu lỡ gọi stream build mà hết JWT |

---

## 10. Env liên quan tải

| Biến | Ảnh hưởng tải |
| --- | --- |
| `STORAGE_DIR` | gốc file `mini-apps/…` (mặc định `var/storage`) |
| `API_ORIGIN` (web build) | Next rewrite `/api/*` → Nest — portal GET media same-origin |
| `STORE_PUBLIC_URL` | URL nhúng gói buyer / licence — **không** dựng `downloadUrl` exe unwrap |
| `MINI_APP_TEMPLATE_PATH` | chỉ kênh packaging buyer/seller build — **không** dùng GET media exe |
| `S3_*` | **không** dùng trên store-hideauto hiện tại |

Đổi host public (đổi domain API) **không** sửa chuỗi relative `/api/v1/media/…` đã share
nếu client luôn đi qua cùng origin. Absolute URL đã bookmark tay thì có thể lệch host.

---

## 11. File liên quan

| File | Vai trò lúc tải |
| --- | --- |
| `server/src/scripts/scripts.service.ts` | `mediaUrl`, `saveAs` exe/icon lúc upload, `upsertUploadBuild` |
| `server/src/scripts/apps-upload.controller.ts` | `POST …/apps/upload` — trả `downloadUrl` / `iconUrl` |
| `server/src/storage/storage.service.ts` | `saveAs` / `pathFor` / `readBytes` |
| `server/src/media/media.controller.ts` | `GET /api/v1/media/{*ref}` — **public** phát bytes |
| `server/prisma/schema.prisma` | `MiniAppBuild.fileUrl` giữ ref exe (`builtBy=upload`) |
| `web/src/lib/api.ts` | `mediaUrl` / `downloadMedia` — GET public |
| `web/src/app/portal/mini-apps/new/page.tsx` | upload; nhận JSON có `downloadUrl` |
| `web/src/app/portal/mini-apps/[id]/page.tsx` | upload → media; server/agent → stream build |
| `server/src/builds/builds.controller.ts` | stream build (JWT); Content-Type zip hoặc octet-stream |
| `server/src/app-client/app-download.service.ts` | tải buyer — packaging, **không** exe unwrap |

---

## 12. Nợ (cố ý DEMO)

- Binary **public** nếu biết URL media. `mode=LICENSE` không bảo vệ GET.
- Không proxy có auth / không presign → không thu hồi link đã lộ trừ khi xoá file hoặc
  tắt serve media.
- Không kênh metadata public trả `downloadUrl` cho end-user app (cố ý).
- Re-upload version mới / xoá listing để rò object cũ + icon trên disk.
- Stream build JWT (`…/builds/:id/download`) vẫn `readBytes` cả file vào RAM — kênh
  phụ; bản upload nên đi media stream.

Prod (market): cân nhắc auth trước khi serve `mini-apps/**`, hoặc private storage +
presign / entitlement trước khi stream. Hiện **chưa** làm trên kênh media.

---

_Tải exe unwrap = GET ẩn danh tới URL đã dựng lúc upload (`/api/v1/media/…`). Store chỉ
ghi file + trả URL; không có handle stream riêng cho installer đó. Kênh buyer packaging
là luồng khác._

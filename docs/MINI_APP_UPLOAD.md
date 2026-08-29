# Mini-app upload

> Seller **APPROVED** nộp file **`.haup`** trên cổng
> [`/portal/mini-apps`](../web/src/app/portal/mini-apps). Server **giải mã wrapper lớp A
> (HAUP2)**, lấy **exe + metadata + icon** từ trong file, rồi ingest vào `scripts` /
> `script_versions` (tách graph, scrub credential, derive metadata). Admin duyệt version
> rồi listing mới lên store.
>
> **`.exe` không phải file user chọn.** Đó là installer nằm *trong* `.haup` sau unwrap.
>
> Không nhầm với:
>
> - **Đóng gói lại khi buyer tải** — [script-publish-packaging.md](./script-publish-packaging.md)
> - **License / redeem / entitlement** — [mini-app-licensing.md](./mini-app-licensing.md)
> - **Ảnh listing** (`POST /api/v1/media`) — thumbnail / gallery, không phải gói app

## 1. Phạm vi

- **Trong phạm vi:** nhận `.haup`, unwrap lớp A, inspect, tạo listing, version mới, submit
  review, duyệt.
- **Ngoài phạm vi:** ký licence, redeem key, template-inject lúc buyer tải.
- **Ai upload:** seller đã `APPROVED` (JWT store). Admin duyệt trên `/admin`, không nộp
  `.haup` thay seller. Buyer / flowdesk **không** upload.
- **Storage:** content-addressed dưới `STORAGE_DIR` (`StorageService`). Không dùng bảng
  `MiniApp` / S3 key `mini-apps/{appId}/…` của Manager cũ.

## 2. File liên quan

| Vai trò | File |
| --- | --- |
| Trang upload listing mới | `web/src/app/portal/mini-apps/new/page.tsx` |
| Danh sách / chi tiết + version mới | `web/src/app/portal/mini-apps/page.tsx`, `[id]/page.tsx` |
| Client `fetch` + proxy `/api/*` | `web/src/lib/api.ts`, `web/next.config.ts` |
| DTO frontend | `web/src/types.ts` (`Script`, `ScriptVersion`, `ScriptInspect`) |
| Admin queue | `web/src/app/admin/page.tsx` |
| Controller upload | `server/src/scripts/scripts.controller.ts` (`api/v1/scripts`) |
| Ingest / versioning | `server/src/scripts/scripts.service.ts` |
| DTO multipart | `server/src/scripts/dto/create-script.dto.ts`, `create-version.dto.ts` |
| Unwrap `.haup` (lớp A) | `server/src/common/graph/mini-app-container.ts` |
| Tách graph khỏi exe/zip sau unwrap | `server/src/common/graph/package-extract.ts` |
| Scrub + derive | `server/src/common/graph/workflow-graph.ts` |
| Storage content-addressed | `server/src/storage/storage.service.ts` |
| Duyệt version | `server/src/admin/admin.service.ts` (`approveVersion` / `rejectVersion`) |
| Schema | `server/prisma/schema.prisma` → `Script`, `ScriptVersion` |
| Guard bán hàng | `server/src/auth/approved-seller.guard.ts` |
| Tạo file demo | `scripts/make-demo-app.mjs` |

Không còn model `MiniApp` / route Manager `/api/apps/upload`. Listing = `scripts`.

## 3. Luồng tổng

```
Seller APPROVED  (portal /portal/mini-apps/new)
  chọn .haup  (+ mô tả, media; name/version/icon có thể sửa trên form)
        │
        ▼
POST /api/v1/scripts/inspect          dry-run, không ghi DB
  parseMiniAppContainer(.haup)        giải mã lớp A → exe + innerHeader
  extractPackage(exe)                 graph từ resources/app.workflow (nếu đọc được)
  scrubCredentials → deriveMetadata
  JSON ScriptInspect (… + name/version/appId từ innerHeader)
        │
        ▼
POST /api/v1/scripts                  multipart: file=.haup + listing fields
  unwrap → ingest graph đã scrub
  lưu graph → STORAGE_DIR/graphs/{aa}/{sha256}.json
  icon PNG (nếu decode được) → STORAGE_DIR/media/… → thumbnailUrl khi form không gửi ảnh
  tạo Script status=DRAFT
  tạo ScriptVersion status=PENDING_REVIEW
  latestVersion* trỏ bản đầu (chưa có version APPROVED nào)
        │
        ▼
POST /api/v1/scripts/:id/submit       DRAFT|REJECTED → PENDING_REVIEW
        │
        ▼
Admin /admin
  PATCH /api/v1/admin/scripts/versions/:id/approve
    chặn nếu chưa có fileUrl
    chặn 409 credentials_present nếu scan.embedded_credentials_count > 0
    version → APPROVED; listing → PUBLISHED; latestVersion* = bản này
  hoặc reject (kèm reviewNote)
```

Cập nhật gói sau khi đã bán: `POST /api/v1/scripts/:id/versions` với file `.haup` mới.
Nếu đã có ≥1 version `APPROVED` → không đụng `latestVersion*` cho tới khi admin duyệt.

**Name / version / icon / appId / builderId** lấy từ `.haup` sau giải mã. Seller bổ sung
mô tả listing, `minAppVersion`, tag, media. `appId` / `appName` / `version` (nếu innerHeader
hợp lệ `x.y.z`) **không** tin form.

Exe đã unwrap **không** persist — graph đã scrub mới được lưu (exe có thể còn secret trong
`resources/app.workflow`).

## 4. Client (portal)

Browser gọi same-origin `/api/v1/...`; Next rewrite sang Nest (`API_ORIGIN`). Token seller:
`storeautohide.token`. Seller chưa `APPROVED` → `ApprovedSellerGuard` 403.

Spec picker: `accept=".haup,application/octet-stream"`.

```
POST /api/v1/scripts/inspect
Content-Type: multipart/form-data

file    File    bắt buộc, .haup
```

Cùng shape: `POST /api/v1/scripts/:id/inspect`.

Tạo listing: `POST /api/v1/scripts` — `file` = `.haup`, các field string
(`name`, `shortDescription`, `description`, `version`, `tagIds`, …). Listing mới là **DRAFT**
— cần Submit trên trang chi tiết rồi admin duyệt.

## 5. Server — ingest

1. Unwrap `.haup` — `parseMiniAppContainer` (§6). Lỗi magic/khoá → **400** lớp A
   (`wrapper_bad_magic` / `wrapper_decrypt_failed` / `wrapper_key_missing` / `wrapper_invalid`).
2. `extractPackage(exeBytes, {slug}-setup.exe)` — graph từ zip-folder hoặc opaque installer.
3. `scrubCredentials(graph)` — `scan` chỉ **đường dẫn**, không giá trị.
4. `storage.saveBytes` graph đã scrub dưới `graphs/`.
5. `deriveMetadata` chỉ khi `graphExtracted`.
6. Ghi `ScriptVersion`: `delivery`, `graphExtracted`, `appId`/`appName` (ưu tiên innerHeader
   rồi envelope), `scan`, `fileUrl` = ref graph.

Không đánh status `UPLOADING` / `READY`. Upsert thẳng thành version `PENDING_REVIEW`.

## 6. Định dạng file `.haup` (lớp A, v2)

Phải khớp app: `workflow/src/main/mini-app/mini-app-wrapper.ts`.

```
[ magic "HAUP2" 5B ]
[ outerLen u32 LE 4B ]
[ outerHeader JSON ]
[ ciphertext ]
```

`outerHeader`:

```json
{
  "v": 2,
  "alg": "x25519-aes256gcm-hkdfsha256",
  "builderId": "",
  "appId": "com.hideauto.mini.demo",
  "ephPub": "<JWK x, X25519>",
  "iv": "<base64 12B>",
  "tag": "<base64 GCM tag>"
}
```

Giải mã:

```
shared = ECDH(MINI_APP_WRAPPER_PRIVATE_KEY, ephPub)
key    = HKDF-SHA256(shared, salt=empty, info="hideauto-miniapp-wrapper-v2", 32B)
plain  = AES-256-GCM(ciphertext, key, iv, aad=builderId\0appId)
```

Sửa `builderId` / `appId` trên header mà không mã lại → decrypt fail (AAD). Chỉ server giữ
private key mới mở được — builder không chạy exe cục bộ từ `.haup`.

`innerPayload` sau decrypt:

```
[ innerLen u32 LE ]
[ innerHeader JSON { name, version, iconPng?, createdAt } ]
[ exe bytes ]
```

`iconPng` là PNG base64. Thiếu hoặc decode fail → bỏ qua, không chặn upload.

Sau unwrap, exe được `extractPackage` xử lý như gói mini-app:

| Inner exe | Kết quả |
| --- | --- |
| Zip (`PK\x03\x04`) có `resources/app.workflow` | `delivery=mini_app_exe`, `graphExtracted=true` |
| Installer packed (không unzip được) | opaque, `graphExtracted=false` |

`.hideflow` mã hoá (`HFLW`) **không** thay `.haup` — 422 `hideflow_encrypted`.

## 7. Ghi DB

Không upsert theo `appId` toàn cục (khác Manager cũ). Mỗi lần nộp `.haup` = một
`script_versions` mới thuộc seller đang login. Unique: `(scriptId, version)`.

| Field | Create / Update |
| --- | --- |
| `scripts.name` | innerHeader sau unwrap; seller có thể sửa trên form |
| `scripts.slug` | slugify từ `name` |
| `scripts.status` | `DRAFT` → submit `PENDING_REVIEW` → approve `PUBLISHED` (trừ `ARCHIVED`) |
| `scripts.hasMiniApp` | `delivery === 'mini_app_exe'` |
| `scripts.thumbnailUrl` | form, không thì icon PNG từ wrapper (nếu decode được) |
| `script_versions.version` | innerHeader nếu `^\d+\.\d+\.\d+$`, không thì form |
| `script_versions.appId` / `appName` | outerHeader.appId / innerHeader.name (rồi envelope) |
| `fileUrl`, checksum | graph đã scrub |
| `script_versions.status` | `PENDING_REVIEW` lúc upload |

`builderId` trên header dùng cho AAD; **không** có cột DB — chủ listing là `scripts.sellerId`.

## 8. Env

```
STORAGE_DIR=var/storage

# Private key X25519 — PKCS8 DER encode base64. Khớp public key nhúng app.
MINI_APP_WRAPPER_PRIVATE_KEY=
```

Cặp khoá: public nhúng app (`HIDEAUTO_WRAPPER_PUBLIC_KEY` / `mini-app-wrapper.ts`), private
đặt env store. Lệch khoá → mọi `.haup` fail giải mã.

Sinh cặp (xem `.env.example`):

```bash
node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('x25519');\
console.log('PUBLIC(JWK x)=',publicKey.export({format:'jwk'}).x);\
console.log('PRIVATE(PKCS8 base64)=',privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))"
```

Layout storage:

```
{STORAGE_DIR}/graphs/{2 hex đầu}/{sha256}.json
{STORAGE_DIR}/media/{2 hex đầu}/{sha256}.png
```

## 9. Test local

```bash
node scripts/make-demo-app.mjs --name "Anna Bot" --version 1.0.0 \
    [--appId com.hideauto.mini.anna-bot] [--builderId u-123] \
    [--exe setup.exe] [--icon icon.png] [--out out.haup]
```

Script mã hoá **y hệt app**, mặc định public key DEV trong `.env.example`. File ra upload được
trên `/portal/mini-apps` nếu store đang dùng private key khớp cặp đó.

Không `--exe` → sinh bytes giả (~2KB) chỉ để test unwrap, không phải installer.

Unit test crypto: `cd server && pnpm test:container`.

## 10. Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
| --- | --- |
| 403 `seller_not_approved` | seller chưa `APPROVED` |
| 400 `wrapper_bad_magic` | file không phải HAUP2 |
| 400 `wrapper_decrypt_failed` | sai `MINI_APP_WRAPPER_PRIVATE_KEY`, file hỏng, hoặc AAD bị sửa |
| 400 `wrapper_key_missing` | thiếu env |
| 400 `wrapper_invalid` | header/payload cắt cụt, sai alg, icon không liên quan |
| 422 `hideflow_encrypted` | nộp `.hideflow` thay vì `.haup` |
| 409 `version_exists` | cùng `(scriptId, version)` |
| 409 `credentials_present` | graph còn secret — admin không duyệt |
| 409 `version_has_no_file` | version không có `fileUrl` |
| Upload OK nhưng icon trống | `iconPng` thiếu hoặc không phải PNG hợp lệ — cố ý không fail |

## 11. Nợ / hạn chế (cố ý lúc DEMO)

- Multer buffer cả `.haup` vào RAM (128 MB) — prod nên stream decrypt rồi mới tách exe.
- Re-upload version mới không dọn graph/icon cũ trong `STORAGE_DIR` (content-addressed,
  trùng checksum thì không tốn thêm đĩa).
- `builderId` trên header chưa gắn seller đang upload (chống nộp file của builder khác).
- License grandfather khi đổi mode PUBLIC → LICENSE không thuộc luồng này.

---

*Magic / HKDF info / AAD phải khớp `mini-app-wrapper.ts`. Đổi một phía → mọi `.haup` thành
rác.*

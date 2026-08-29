# Mini-app upload — handle server

> Chi tiết **tầng server** của `POST /api/apps/upload`.
> Tổng quan luồng (kèm client): [MINI_APP_UPLOAD.md](./MINI_APP_UPLOAD.md).
>
> Entry: `src/app/api/apps/upload/route.ts` → unwrap
> `src/server/mini-apps/container.ts` → S3 `src/server/resources/storage.ts` →
> Prisma `mini_apps`.

Handler **không** dùng server action. Binary + S3 SDK cần Node runtime; client cần
progress XHR nên gọi route handler trực tiếp.

---

## 1. Entry & runtime

```ts
// src/app/api/apps/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) { … }
```

| Flag | Lý do |
|---|---|
| `runtime = "nodejs"` | `Buffer`, `crypto` Node, `Readable.from`, AWS SDK, Prisma. Edge không chạy được. |
| `dynamic = "force-dynamic"` | Body multipart mỗi request khác nhau; không cache / không prerender. |

Không khai báo `maxDuration` / `bodyParser` size. Giới hạn thực tế = Next.js +
reverse proxy (nginx / IIS). Route **không** tự cắt dung lượng.

Chỉ export `POST`. `GET`/`PUT`/`OPTIONS` → Next 405.

URL thực tế: `{BASE_PATH}/api/apps/upload` (vd `/manager/api/apps/upload`).
`basePath` do Next gắn ở tầng framework; trong handler chỉ thấy pathname đã strip.

---

## 2. Lớp bảo vệ (hai tầng)

### 2.1 Middleware (chưa login)

`src/middleware.ts` + `authorized` trong `src/server/auth.config.ts`.

Matcher **không** loại trừ `/api/apps/*` (chỉ loại `api/auth`, static, file có dấu chấm).
Request chưa cookie session → Auth.js redirect HTML `/login`, **không** vào handler.

Hệ quả: client nhận redirect, không phải JSON 401. Handler không bao giờ chạy
khi chưa đăng nhập.

`/api/v1/mini-apps/*` cũng bị matcher này — endpoint “public” ghi trong comment
vẫn cần session Manager nếu gọi cùng origin. Không liên quan upload, nhưng cùng
cơ chế.

### 2.2 Handler — `requireRole("ADMIN")`

```ts
try {
  admin = await requireRole("ADMIN");
} catch {
  return NextResponse.json({ error: "Không đủ quyền" }, { status: 403 });
}
```

`requireRole` (`src/server/guards.ts`):

1. `auth()` → session JWT (maxAge 8h).
2. Không có `user.id` → ném `UNAUTHENTICATED`.
3. Rank `SUPER_ADMIN (3) > ADMIN (2) > VIEWER (1)`.
4. `rank < ADMIN` → ném `FORBIDDEN`.

Cả hai lỗi bị `catch` nuốt → **cùng 403** `"Không đủ quyền"`. Không phân biệt hết
session vs VIEWER (middleware thường chặn hết session trước).

`admin` giữ `{ id, email, name, role }` dùng cho `builderId` first-claim và audit.
VIEWER không upload được dù UI ẩn form.

---

## 3. Parse request

Không đọc `req.body` dạng stream (khác artifact resource). Dùng Web `FormData`.

```ts
try {
  form = await req.formData();
} catch {
  return NextResponse.json({ error: "Body phải là multipart/form-data" }, { status: 400 });
}
```

`formData()` fail khi: không phải multipart, body hỏng, hoặc runtime không parse được.

Sau đó **không** Zod — lấy tay:

| Field | Nguồn | Xử lý | Bắt buộc |
|---|---|---|---|
| `file` | `form.get("file")` | phải `instanceof File` | có |
| `description` | `form.get("description")` | `String(…).trim()`, rỗng → `null` lúc ghi DB | không |
| `mode` | `form.get("mode")` | mặc định `"PUBLIC"`; chỉ `PUBLIC` \| `LICENSE` | có (sau default) |

```
file không phải File  → 400  { error: "Thiếu file" }
mode ∉ {PUBLIC,LICENSE} → 400  { error: "Mode không hợp lệ" }
```

`File` ở đây là Web File (Next polyfill trên Node). `arrayBuffer()` ở bước sau
đọc **toàn bộ** nội dung vào RAM.

Tên field cứng: `file` / `description` / `mode`. Sai tên = thiếu file / mode default PUBLIC.

Không đọc `Content-Length`, không check extension `.haup`, không check MIME.
File rác bị loại ở unwrap (magic / decrypt).

---

## 4. Unwrap — `parseMiniAppContainer`

```ts
const buf = Buffer.from(await file.arrayBuffer());
({ header, exe } = parseMiniAppContainer(buf));
```

Mọi lỗi unwrap → **400**, không 500.

```
e instanceof MiniAppContainerError  → e.message
còn lại (OOM, arrayBuffer fail, …)  → "Không đọc được file mini-app"
```

⚠️ **DEMO:** cả `.haup` nằm trong một `Buffer`. Setup ~9MB chấp nhận được.
Nhiều request song song = nhiều bản copy (arrayBuffer + Buffer + ciphertext +
plaintext + exe). Prod: stream, decrypt lớp A, rồi mới tách exe.

`container.ts` đánh `import "server-only"` — không import từ client.

### 4.1 Layout byte

Offset 0, little-endian:

```
 0        5              9                    9+outerLen              EOF
 | HAUP2  | outerLen u32 | outerHeader (JSON) | ciphertext (AES-GCM) |
   5 bytes    4 bytes         outerLen bytes        phần còn lại
```

Hằng: `MAGIC = "HAUP2"`, `PREFIX = 9`, `HKDF_INFO = "hideauto-miniapp-wrapper-v2"`.

Phải khớp app `workflow/src/main/mini-app/mini-app-wrapper.ts`. Đổi magic / info /
AAD một phía → mọi file thành rác.

### 4.2 Outer header (plaintext)

JSON UTF-8, độ dài = `outerLen`.

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `v` | có, phải `=== 2` | |
| `alg` | string non-empty | **không** so khớp literal; chỉ kiểm có mặt |
| `appId` | string non-empty | identity upsert |
| `ephPub` | string non-empty | JWK `x` của X25519 ephemeral |
| `iv` | string non-empty | base64, 12 byte khi decode |
| `tag` | string non-empty | base64 GCM tag |
| `builderId` | không | không phải string → `""` |

Thiếu field bắt buộc → `"Outer header thiếu trường bắt buộc."` — **trước** decrypt.

`ciphertext = buf.subarray(9 + outerLen)`. Rỗng → `"Không có ciphertext trong file."`

Các lỗi layout khác (ném `MiniAppContainerError`, route trả 400):

| Điều kiện | Message |
|---|---|
| `buf.length < 9` | File quá nhỏ / không đúng định dạng mini-app. |
| magic ≠ `HAUP2` | Sai magic — không phải file mini-app hợp lệ (cần HAUP2). |
| `outerLen <= 0` hoặc `9+outerLen > buf.length` | Outer header hỏng — độ dài không hợp lệ. |
| JSON.parse fail | Outer header không phải JSON hợp lệ. |

### 4.3 Hybrid decrypt

Private key chỉ load **sau** khi outer header hợp lệ (file rác không đụng env).

`MINI_APP_WRAPPER_PRIVATE_KEY` = PKCS8 DER, encode base64, curve X25519.

```
raw thiếu        → MiniAppContainerError  Chưa cấu hình MINI_APP_WRAPPER_PRIVATE_KEY …
base64/PKCS8 hỏng → MiniAppContainerError  MINI_APP_WRAPPER_PRIVATE_KEY không hợp lệ (cần PKCS8 base64).
```

Cả hai vẫn là **400** (nhánh unwrap), không 500.

Thuật toán:

```
ephPub  = PublicKey JWK { kty: OKP, crv: X25519, x: outer.ephPub }
shared  = ECDH(hideautoPriv, ephPub)          // Node crypto.diffieHellman
key     = HKDF-SHA256(shared, salt=0-byte, info="hideauto-miniapp-wrapper-v2", length=32)
plain   = AES-256-GCM-decrypt(ciphertext, key, iv=base64(outer.iv), tag=base64(outer.tag),
                             aad = utf8(builderId + "\0" + appId))
```

AAD bind `builderId` + `appId`. Sửa hai field trên JSON mà không mã lại → tag fail.

Mọi lỗi crypto (ephPub hỏng, IV/tag sai, sai private key, AAD lệch) gộp một
message mờ: `"Giải mã thất bại — file hỏng hoặc sai khoá."` — không lộ khoá / tag.

Chỉ server giữ private key mới mở `.haup`. Builder không chạy exe từ file upload.

### 4.4 Inner payload (sau decrypt)

```
 0         4                   4+innerLen              EOF(plain)
 | innerLen | innerHeader JSON | exe bytes             |
    u32 LE       innerLen bytes   phần còn lại
```

| Field inner JSON | Bắt buộc |
|---|---|
| `name` | string non-empty |
| `version` | string non-empty |
| `iconPng` | không — PNG base64 |
| `createdAt` | không — parse xong giữ, route **không dùng** |

`exe.length === 0` → `"Không có phần exe trong file."`

Output:

```ts
{
  header: { appId, builderId, name, version, iconPng?, createdAt? },
  exe: Buffer   // bytes cài đặt, chưa ghi đĩa
}
```

`appId` / `builderId` lấy từ **outer** (đã bind AAD). `name` / `version` / `iconPng`
từ **inner** (đã authenticated-encrypt). Không tin field client multipart cho các giá trị này.

---

## 5. Sau unwrap — try/catch 500

Mọi thứ sau unwrap (slug, S3, Prisma, audit) nằm trong `try` riêng. Lỗi → **500**
`{ error: e.message | "Upload lỗi" }`.

Không rollback S3 nếu Prisma fail sau khi `uploadToS3` thành công. Không transaction
bao S3 + DB.

### 5.1 Tên file exe

```ts
slug(header.name) → trim → lower → [^a-z0-9]+ thành "-" → bỏ "-" đầu/cuối → slice(0, 60)
                   → rỗng thì "mini-app"
exeName = `${appSlug}-setup.exe`
```

Ví dụ: `"Anna Bot"` → `anna-bot-setup.exe`. `name` DB vẫn nguyên (hoa, khoảng trắng).
Slug chỉ cho key S3 / `fileName`.

Không sanitize `header.appId` / `header.version` trước khi ghép key. Giá trị đi
thẳng vào path S3. Ký tự lạ / `../` phụ thuộc cách SDK encode key.

### 5.2 Exe → S3 (bắt buộc)

```
key  = mini-apps/{appId}/{version}/{slug}-setup.exe
mime = application/octet-stream
body = Readable.from(exe)     // Buffer đã có sẵn → stream cho SDK
```

`uploadToS3` (`storage.ts`):

1. Thiếu `S3_BUCKET` / access / secret → throw → 500.
2. Transform stream: mỗi chunk `hash.update` (SHA-256) + cộng `fileSize` (`bigint`).
3. `@aws-sdk/lib-storage` `Upload`: `queueSize=4`, `partSize=8MiB`, multipart tự động.
4. `await upload.done()`.
5. Trả `{ provider: "S3", storageKey: key, downloadUrl, fileSize, checksumSha256 }`.

`downloadUrl` (không presign, không hết hạn):

```
base = S3_PUBLIC_BASE_URL || S3_ENDPOINT || https://{bucket}.s3.{region}.amazonaws.com
       (bỏ slash cuối)

nếu S3_FORCE_PATH_STYLE=true và base chưa kết thúc bằng /{bucket}:
    {base}/{bucket}/{encodeKey}
không thì:
    {base}/{encodeKey}
```

`encodeKey` = `encodeURIComponent` từng segment, giữ `/`.

Bucket/prefix phải **đọc ẩn danh** — Manager không phát hành signed URL.

Cùng `appId` + cùng `version` → cùng key → S3 ghi đè.
Cùng `appId`, `version` mới → key mới → object cũ **không xoá**.

### 5.3 Icon → S3 (tuỳ chọn, best-effort)

Chỉ chạy khi `header.iconPng` truthy.

```
try {
  iconBuf = Buffer.from(header.iconPng, "base64")
  if (iconBuf.length > 0)
    uploadToS3(mini-apps/{appId}/icon.png, image/png, Readable.from(iconBuf))
    iconUrl = iconRes.downloadUrl
} catch { /* nuốt */ }
```

| Tình huống | `iconUrl` |
|---|---|
| không có `iconPng` | `null` |
| base64 rỗng | `null` (không gọi S3) |
| S3 / decode throw | `null` (nuốt) |
| upload OK | public URL |

Icon fail **không** fail request, **không** rollback exe. Không kiểm PNG magic —
base64 bất kỳ vẫn PUT `image/png`.

Key icon **không** có version → re-upload luôn ghi đè icon. Xoá app không gọi
`deleteFromStorage` cho key icon.

### 5.4 `builderId`

```ts
const builderId = header.builderId || admin.id;
```

- Có trong wrapper (AAD) → dùng, không tin form.
- Rỗng (build lúc chưa login) → first-claim = `admin.id` người upload.

TODO prod builder-portal: `header.builderId ===` tài khoản builder đang upload.
Hiện admin ≠ builder, chỉ ghi nhận.

Chỉ dùng lúc **create**. Nhánh `update` không đụng `builderId` → re-upload không cướp chủ.

### 5.5 Upsert `mini_apps`

```ts
prisma.miniApp.upsert({ where: { appId: header.appId }, create, update })
```

Unique `app_id` VARCHAR(191). `id` UUID chỉ lúc create (`@default(uuid())`).

**Create**

| Cột | Giá trị |
|---|---|
| `appId` | `header.appId` |
| `builderId` | như §5.4 |
| `name` | `header.name` |
| `version` | `header.version` |
| `mode` | form |
| `description` | form trim hoặc `null` |
| `iconUrl` | URL S3 hoặc `null` |
| `provider` | `"S3"` (enum; comment schema: chung AWS/MinIO/R2) |
| `storageKey` | key exe |
| `downloadUrl` | URL public exe |
| `fileName` | `{slug}-setup.exe` |
| `fileSize` | `bigint` từ stream hash |
| `checksumSha256` | hex SHA-256 exe (64 ký tự) |
| `createdAt` / `updatedAt` | Prisma default |

**Update** — **không** ghi: `appId`, `builderId`, `provider`.

| Cột | Giá trị |
|---|---|
| `name`, `version` | header mới |
| `mode`, `description` | form lần này (ghi đè) |
| `iconUrl` | **chỉ khi** `iconUrl` truthy; không có icon mới → giữ URL cũ |
| `storageKey`, `downloadUrl`, `fileName`, `fileSize`, `checksumSha256` | exe mới |

Không có cột status `UPLOADING`/`READY` (khác `resource_artifacts`). Bản ghi
xuất hiện là “đã publish” với `GET /api/v1/mini-apps/:appId`.

Không `revalidatePath("/apps")`. Trang apps là server component `force-dynamic`;
client tự `router.refresh()` sau XHR.

Prisma fail (độ dài cột, DB down) **sau** S3 thành công → 500, object S3 mồ côi,
audit không ghi.

### 5.6 Audit

```ts
await writeAudit({
  adminId: admin.id,
  action: "mini-app.upload",
  targetType: "mini_app",
  targetId: saved.id,          // UUID nội bộ, không phải appId
  meta: { appId, version, mode },
});
```

`writeAudit` (`src/server/audit.ts`): insert `admin_audit_logs`, IP từ
`x-forwarded-for` (phần đầu) hoặc `x-real-ip`. **Nuốt lỗi** (log console) — audit
fail không đổi 200.

`fileName` / checksum / `builderId` không nằm trong `meta`.

---

## 6. Response

### 200

```json
{
  "ok": true,
  "appId": "com.hideauto.mini.anna-bot",
  "name": "Anna Bot",
  "version": "1.0.0",
  "mode": "PUBLIC",
  "downloadUrl": "https://…/mini-apps/…/anna-bot-setup.exe",
  "iconUrl": "https://…/mini-apps/…/icon.png",
  "fileSize": 1234567,
  "checksumSha256": "<64 hex>"
}
```

`fileSize` = `Number(bigint)` — mất chính xác nếu exe > `Number.MAX_SAFE_INTEGER`
(~8 PB, không thực tế). `iconUrl` có thể `null`.

### Lỗi

| Status | `error` | Giai đoạn |
|---|---|---|
| 403 | Không đủ quyền | `requireRole` (VIEWER / unauthenticated lọt middleware) |
| 400 | Body phải là multipart/form-data | `formData()` throw |
| 400 | Thiếu file | không có `File` |
| 400 | Mode không hợp lệ | không phải PUBLIC/LICENSE |
| 400 | *(message unwrap)* | `MiniAppContainerError` — bảng §4.2–4.4 |
| 400 | Không đọc được file mini-app | unwrap throw không phải `MiniAppContainerError` |
| 405 | — | method ≠ POST |
| 500 | Chưa cấu hình S3_ACCESS_KEY_ID / … / S3_BUCKET | `s3()` |
| 500 | Chưa cấu hình S3_BUCKET | `uploadToS3` |
| 500 | *(AWS / Prisma message)* | S3 hoặc DB |
| 500 | Upload lỗi | throw không phải `Error` |

Redirect login (middleware) không phải JSON.

---

## 7. Sơ đồ control-flow

```
POST /api/apps/upload
        │
        ├─ middleware: chưa login → redirect /login
        │
        ▼
requireRole("ADMIN") ── fail → 403
        │
        ▼
req.formData() ── fail → 400 multipart
        │
        ├─ !File → 400 thiếu file
        ├─ mode lạ → 400 mode
        │
        ▼
file.arrayBuffer() → Buffer          ⚠ RAM
parseMiniAppContainer
        │
        ├─ layout / JSON / thiếu field → 400
        ├─ loadPrivateKey thiếu/hỏng   → 400
        ├─ ECDH+HKDF+GCM fail          → 400 giải mã thất bại
        └─ inner thiếu name/version/exe→ 400
        │
        ▼
slug(name) → exeName
uploadToS3(exe) ── fail → 500, DB chưa đụng
        │
        ├─ iconPng? uploadToS3(icon) ── fail → nuốt, iconUrl=null
        │
        ▼
builderId = header.builderId || admin.id
prisma.miniApp.upsert(appId)
        │                          ── fail → 500, S3 exe (và icon) đã nằm bucket
        ▼
writeAudit("mini-app.upload")      ── fail → nuốt, vẫn 200
        │
        ▼
200 { ok, appId, name, version, mode, downloadUrl, iconUrl, fileSize, checksumSha256 }
```

---

## 8. Atomicity & side-effect

Không có `$transaction` bao S3. Thứ tự cố định: **S3 exe → S3 icon → DB → audit**.

| Fail tại | S3 exe | S3 icon | DB | Audit | Client |
|---|---|---|---|---|---|
| unwrap | — | — | — | — | 400 |
| upload exe | có thể dở dang (SDK dọn part) | — | — | — | 500 |
| upload icon | đã có | fail / bỏ | chưa | — | tiếp tục |
| Prisma | đã có | có thể có | không đổi | — | 500, object mồ côi |
| audit | đã có | có thể có | đã ghi | không | **200** |

Re-upload version mới: hàng DB trỏ key mới; exe version cũ + icon history không
dọn. `deleteMiniAppAction` chỉ `deleteFromStorage(storageKey)` = exe **hiện tại**,
không xoá `mini-apps/{appId}/icon.png` lẫn prefix version cũ.

Checksum / size là của **exe đã giải mã**, không phải file `.haup` upload.

---

## 9. Env server đọc

| Biến | Chỗ đọc | Thiếu thì |
|---|---|---|
| `MINI_APP_WRAPPER_PRIVATE_KEY` | `container.ts` lúc decrypt | 400 |
| `S3_ACCESS_KEY_ID` | `storage.ts` `s3()` | 500 |
| `S3_SECRET_ACCESS_KEY` | `s3()` | 500 |
| `S3_BUCKET` | `s3()` / `uploadToS3` | 500 |
| `S3_REGION` | default `us-east-1` | — |
| `S3_ENDPOINT` | optional (MinIO / R2) | AWS virtual-hosted |
| `S3_FORCE_PATH_STYLE` | `"true"` → path-style URL | |
| `S3_PUBLIC_BASE_URL` | ưu tiên khi dựng `downloadUrl` | fallback endpoint / AWS |
| `BASE_PATH` | Next config, không trong handler | client XHR 404 nếu lệch |
| `AUTH_SECRET` | session JWT | middleware/auth fail |

Sinh cặp X25519: `.env.example`. Public nhúng app, private chỉ env Manager.

---

## 10. Việc handler **không** làm

- Không presigned URL / upload ticket (`uploadTicketSchema` không dùng ở đây).
- Không invalidate Redis manifest (`resource:manifest:v1` chỉ artifact resource).
- Không ghi `resource_artifacts`, không status `UPLOADING`.
- Không lưu `.haup` gốc — chỉ exe + icon.
- Không verify chữ ký ngoài AES-GCM; không antivirus / không cap size.
- Không enforce `builderId` khớp người upload.
- Không dọn object S3 cũ khi đổi version / khi Prisma fail.
- Không `revalidatePath`; không đổi license/grandfather khi `PUBLIC → LICENSE`.

So với artifact resource (`PUT /api/resources/[versionId]/upload`): luồng kia
stream `req.body` thẳng S3, upsert artifact + `UPLOADING`→`READY`/`FAILED`, xoá
object cũ, xoá cache manifest. Mini-app **không** làm các bước đó.

---

## 11. File server

| File | Vai trò trong handle |
|---|---|
| `src/app/api/apps/upload/route.ts` | `POST`: auth, parse, orchestration |
| `src/server/mini-apps/container.ts` | parse + decrypt HAUP2 → `{ header, exe }` |
| `src/server/resources/storage.ts` | `uploadToS3` / `buildDownloadUrl` |
| `src/server/guards.ts` | `requireRole("ADMIN")` |
| `src/server/audit.ts` | `writeAudit` (fail-open) |
| `src/server/db.ts` | Prisma singleton |
| `src/server/auth.config.ts` | middleware bắt login trước khi vào route |
| `prisma/schema.prisma` | model `MiniApp` → bảng `mini_apps` |

---

_Tham số crypto + layout byte phải khớp app. Đổi `HAUP2` / HKDF info / AAD /
PKCS8 env một phía → unwrap luôn 400._

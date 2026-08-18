# Mini-app Licensing — key kích hoạt mini app

Tài liệu cho luồng **seller phát key → buyer nhập key trong mini app → mini app chạy được**.
Phần đóng gói/publish: [script-publish-packaging.md](./script-publish-packaging.md). Data model:
[server/prisma/schema.prisma](../server/prisma/schema.prisma).

> **Tóm tắt 1 dòng**: store ký một **licence Ed25519** gắn với (mini app, user, máy); gói mini app
> mang sẵn public key và tự kiểm licence lúc mở, hết hạn thì hỏi lại store.

> ⚠️ **Trạng thái sau khi chuyển sang NestJS: đây là SPEC, chưa có code.**
> Bản Python cũ từng làm xong §3–§5, nhưng phần đó **chưa được port** (xem `git log -- api`).
> Server hiện tại **chưa có** `/app/*` (heartbeat, entitlement, licence ký Ed25519, buyer download).
> Seller phát key thì đã chạy (`/api/v1/keys`). Cổng nhập key trong mini app ở repo
> `desktop-app-workflow`, xem §6.

---

## 1. Ai là ai — hai hệ tài khoản tách biệt

Chỗ này gây nhầm nhiều nhất, ghi lại cho rõ:

| | Seller (portal store) | End-user (app + mini app) |
|---|---|---|
| Kho user | Postgres `sellers` của store | flowdesk (`flowdesk.hachitechsolution.com/api`) |
| Đăng nhập | `POST /api/v1/auth/login` → JWT của store | `POST /api/auth/login` → access + refresh của flowdesk |
| Mật khẩu | bcrypt trong Postgres | do flowdesk giữ |

Store **không bao giờ** tạo hay xác thực tài khoản flowdesk; nó chỉ **kiểm tra token** người mua
đưa lên (`GET /users/me`, `GET /devices` — cũ: `flowdesk_client.py`, chưa port sang NestJS).

⇒ Đăng ký seller ở store **không** sinh ra tài khoản bên app. Cùng một email vẫn là hai bản ghi,
hai mật khẩu. Muốn kích hoạt mini app, buyer **phải có tài khoản app** (đăng nhập trong chính mini app).

---

## 2. Key làm được gì (và không làm được gì)

`seller_keys` phát ra bởi seller, `script_id` = mini app mà nó mở (`null` = khóa toàn shop).
Redeem xong thì quyền nằm ở `seller_members.script_ids` — xem
[script-publish-packaging.md §6.2](./script-publish-packaging.md#62-khóa--quyền-truy-cập).

| | Trước | Sau khi có licence |
|---|---|---|
| Tải gói về | cần key | cần key |
| **Chạy gói đã tải** | **tự do, mãi mãi** | cần licence còn hạn |
| Thu hồi key | không có tác dụng với người đã tải | mini app khoá lại ở lần kiểm kế tiếp |
| Chặn thiết bị | chỉ là ghi chú | từ chối cấp licence cho máy đó |

> **Trần bảo mật**: mini app chạy trên máy người mua, ai quyết tâm vẫn gỡ được đoạn kiểm tra
> (Electron, mở `asar` là thấy). Cơ chế này tạo **ma sát cho việc chia sẻ tuỳ tiện** và cho seller
> **nút thu hồi** — không phải DRM. Muốn chống thật thì phần lõi giá trị phải chạy trên server.

---

## 3. Gói mang gì

Lúc đóng gói lại (`create_build`), store ghi thêm khối `store` vào `resources/app.workflow`:

```jsonc
{
  "version": 1, "appName": "...", "appId": "...", "workflowId": "...", "workflow": { },
  "store": {
    "baseUrl": "https://store.example.com",          // STORE_PUBLIC_URL
    "scriptId": "6a80…",                              // mini app này là script nào
    "sellerName": "Cửa hàng A",
    "licensePublicKey": "base64 32 byte Ed25519",     // khóa để verify licence
    "licenseAlgorithm": "Ed25519"
  }
}
```

- App đời cũ **bỏ qua field lạ** ([`mini-app-state.ts`](../../desktop-app-workflow/src/main/mini-app/mini-app-state.ts)
  chỉ kiểm `version` + các field bắt buộc) ⇒ gói vẫn mở được, chỉ là không có cổng key.
- Chưa đặt `LICENSE_SIGNING_KEY` ⇒ store **không** nhét khối này, ghi log cảnh báo, gói mở tự do.
- Chỉ **public key** đi vào gói. Seed ký nằm ở env của store.

Code cũ (Python, chưa port): `mini_app_builder.build_store_block`, gọi từ
`mini_app_service._store_block`.

---

## 4. Endpoint kích hoạt

`POST /api/v1/app/scripts/{script_id}/license` — bearer = **access token flowdesk** của người dùng.

```jsonc
// request — lần đầu có "key", các lần sau chỉ machine_id
{ "key": "SK-xxxx", "machine_id": "<machineId của máy>" }

// 200
{ "payload_b64": "eyJhcHBf…", "signature": "base64…", "algorithm": "Ed25519" }
```

Store làm tuần tự (code cũ `activation_service.activate`, chưa port):
script tồn tại & `published` → redeem key nếu có → membership `active` + app nằm trong entitlement →
`machine_id` không nằm trong `blocked_devices` → ký licence. Nhân tiện đồng bộ usage (best-effort)
để seller thấy buyer vừa hoạt động.

**Mã lỗi** (`code` trong body, để app hiện đúng câu):

| code | HTTP | Nghĩa |
|---|---|---|
| `key_required` | 403 | Chưa mở khoá app này và không gửi key ⇒ hiện ô nhập key |
| `key_wrong_app` | 403 | Key hợp lệ nhưng của mini app khác |
| `device_blocked` | 403 | Seller đã chặn máy này |
| `script_not_published` | 403 | App bị gỡ khỏi store |
| (redeem) | 404/403 | Key sai/đã thu hồi (404), hết hạn hoặc hết lượt (403) |
| `licensing_unconfigured` | 503 | Store thiếu `LICENSE_SIGNING_KEY` |

---

## 5. Licence — nội dung và cách ký

`payload_b64` là base64 của **đúng chuỗi byte JSON đã được ký**:

```json
{ "format": 1, "script_id": "…", "app_id": "…", "app_name": "…", "seller_name": "…",
  "user_id": "…", "user_email": "…", "machine_id": "…",
  "issued_at": "2026-08-15T08:40:51Z", "expires_at": "2026-08-22T08:40:51Z" }
```

- `machine_id` nằm **trong** phần được ký ⇒ chép file licence sang máy khác là hỏng.
- `expires_at` = `LICENSE_TTL_DAYS` (mặc định 7). Đây vừa là **thời gian dùng offline** của buyer,
  vừa là **độ trễ tối đa khi thu hồi**. Ngắn hơn = siết chặt hơn nhưng gọi về server nhiều hơn.

> ⚠️ **Không tự serialize lại payload để kiểm chữ ký.** Python `json.dumps` escape non-ASCII,
> `JSON.stringify` thì không — chỉ cần tên cửa hàng có dấu là hai bên ra hai chuỗi byte khác nhau
> và chữ ký "sai" oan. Luôn verify trên **chuỗi byte nhận được**, parse sau.
> (Có test cho ca này: `tests/test_mini_app_license.py`.)

Code cũ (Python, chưa port): `license_service.py`.

---

## 6. Việc còn lại — cổng key trong mini app (repo `desktop-app-workflow`)

Thuận lợi: **mini app chính là app đó** — cùng main process, cùng renderer, chỉ khác ở chỗ có
`resources/app.workflow` thì `isMiniApp = true`. Nên nó **đã có sẵn màn đăng nhập flowdesk**
(`AuthGate`); cổng key chỉ là một lớp nữa đặt sau đó.

Checklist:

1. **Đọc khối `store`** từ envelope → thêm vào `MiniAppModeInfo` (`src/main/mini-app/mini-app-state.ts`,
   type ở `src/shared/mini-app.ts`).
2. **`src/main/license/license-service.ts`**: `activate(key)`, `getStatus()`, cache licence xuống
   thư mục dữ liệu của mini app, verify chữ ký, tự hỏi lại store khi quá `expires_at`.
   `machineId` lấy từ `auth-token-store.getMachineId()` (đúng cái đã đăng ký với `/devices`).
3. **Verify bằng Node** — khóa raw 32 byte phải bọc DER SPKI, `crypto.verify` không nhận raw:

   ```ts
   const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey])
   const key = createPublicKey({ key: der, format: 'der', type: 'spki' })
   const ok = verify(null, payloadBytes, key, signatureBytes) // payloadBytes = base64-decode nguyên văn
   ```

4. **Gate ở renderer**: `isMiniApp` + chưa có licence → màn nhập key (sau `AuthGate`).
   Nhớ i18n **cả `en.json` lẫn `vi.json`**, và map `code` từ store ra câu tiếng người.
5. **IPC + preload** cho `license:activate` / `license:status`.
6. **Build lại template mini app** từ app đã có gate → trỏ `MINI_APP_TEMPLATE_PATH` của store vào đó.

⚠️ **Thứ tự bắt buộc**: template hiện tại build từ app **chưa** có gate, nên store có nhét khối
`store` cũng không ai đọc. Bước 6 phải sau bước 1–5.

---

## 7. Cấu hình (store)

| Env | Mặc định | Việc |
|---|---|---|
| `LICENSE_SIGNING_KEY` | trống | base64 seed Ed25519 (32 byte). Trống = **không có cổng key** |
| `LICENSE_TTL_DAYS` | `7` | hạn licence = thời gian offline = độ trễ thu hồi |
| `STORE_PUBLIC_URL` | `http://localhost:3001` | URL nhúng vào gói — buyer phải gọi tới được |
| `MINI_APP_TEMPLATE_PATH` | trống | gói mini app rỗng để inject; trống thì chỉ tải được graph |

Sinh cặp khóa:

```bash
node -e "const{generateKeyPairSync}=require('crypto');const{privateKey}=generateKeyPairSync('ed25519');console.log(privateKey.export({format:'der',type:'pkcs8'}).subarray(16).toString('base64'))"
```

**Xoay khóa làm hỏng mọi gói đã phát hành** (chúng mang public key cũ) — buyer phải tải lại.
Chỉ xoay khi lộ seed.

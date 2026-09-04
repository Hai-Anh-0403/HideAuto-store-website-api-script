# Kiến Trúc Hệ Thống & Đặc Tả Request/Response — Store-HideAuto

> Tài liệu tổng hợp toàn diện về kiến trúc hệ thống, các luồng nghiệp vụ cốt lõi và đặc tả chi tiết Request/Response (Req/Res) của dự án **Store-HideAuto**.

---

## 1. Tổng Quan Dự Án

**Store-HideAuto** là sàn thương mại kịch bản tự động hóa (marketplace) phục vụ cho ứng dụng desktop **hideflow**. Hệ thống cho phép:
- **Seller (Người bán)**: Đóng gói kịch bản thành các mini-app (`.haup` / `.zip` / `.exe`), tải lên store, quản lý phiên bản, phát hành mã khóa bản quyền (`seller_keys`).
- **Admin (Quản trị viên)**: Thẩm định cửa hàng (`sellers`), kiểm tra bảo mật kịch bản (phát hiện lộ lọt credential, node shell rủi ro) và duyệt phát hành.
- **Buyer / Mini-app (Người mua & Runtime)**: Nhập khóa kích hoạt, tải gói kịch bản đã đóng gói lại và chạy với chữ ký bản quyền số (Ed25519).

---

## 2. Kiến Trúc Tổng Thể (System Architecture)

### 2.1 Cấu Trúc Monorepo & Công Nghệ

Dự án tổ chức dạng **pnpm workspace**:
- **[`server/`](../server)**:
  - **Framework**: NestJS 11 (Express platform).
  - **Database**: MySQL 8 thông qua **Prisma 6** (`server/prisma/schema.prisma`).
  - **Auth**: JWT (`@nestjs/jwt` + Passport), băm mật khẩu `bcrypt`.
  - **Storage**: Local content-addressed filesystem (`STORAGE_DIR`).
  - **API Documentation**: Swagger UI tại `/docs`.
- **[`web/`](../web)**:
  - **Framework**: Next.js 15 (App Router), React 19, TypeScript.
  - **Styling**: Vanilla CSS (`web/src/styles/`), không dùng TailwindCSS.
  - **Reverse Proxy**: Next.js rewrite `/api/*` trực tiếp sang NestJS backend (`API_ORIGIN`, mặc định `http://localhost:3001`).

```
                              [ TRÌNH DUYỆT SELLER / ADMIN ]
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │     Web Portal (Next 15)  │
                               │     Port 3000 (React 19)  │
                               └─────────────┬─────────────┘
                                             │ Rewrite /api/*
                                             ▼
[ APP RUNTIME / BUYER ] ──────►┌───────────────────────────────────────────┐
(Flowdesk Bearer Token)        │      NestJS REST API Server (Port 3001)   │
                               │                                           │
                               │ ├── /api/v1/auth (Seller/Admin JWT)       │
                               │ ├── /api/v1/scripts (Ingest, Scrub, Meta) │
                               │ ├── /api/v1/admin (Duyệt seller, version) │
                               │ ├── /api/v1/keys & /members (Quản lý key) │
                               │ ├── /api/v1/builds (Template injection)   │
                               │ ├── /api/v1/app/* (Client API: license)   │
                               │ └── /api/v1/media/* (Public stream)       │
                               └─────────────┬─────────────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
      ┌─────────────────────────────┐                 ┌─────────────────────────────┐
      │        MySQL 8 Database     │                 │ Local Storage (STORAGE_DIR) │
      │ - sellers, admins           │                 │ - /graphs/{aa}/{sha256}.json│
      │ - scripts, script_versions  │                 │ - /media/{aa}/{sha256}.png  │
      │ - seller_keys, members      │                 │ - /mini-apps/{appId}/...    │
      │ - mini_app_builds           │                 └─────────────────────────────┘
      └─────────────────────────────┘
```

---

### 2.2 Hai Hệ Tài Khoản Tách Biệt

| Đặc điểm | Seller / Admin (Store Portal) | Buyer / End-User (App & Mini-app) |
|---|---|---|
| **Cơ sở dữ liệu** | Bảng `sellers` và `admins` trong MySQL của Store | Hệ thống **Flowdesk** (`flowdesk.hachitechsolution.com/api`) |
| **Đăng nhập** | `POST /api/v1/auth/login` $\rightarrow$ JWT Store | Đăng nhập trên app qua Flowdesk $\rightarrow$ Access Token Flowdesk |
| **Vai trò tại Store** | Đăng bán kịch bản, tạo khóa, duyệt bài | Gửi Bearer Token Flowdesk để redeem key, xin cấp licence, tải app |

---

### 2.3 Chiến Lược Lưu Trữ & Bảo Mật Dữ Liệu

1. **Không lưu trữ file upload chứa credential**: Gói `.exe`/`.zip` do seller tải lên có thể chứa secret trong `resources/app.workflow`. Store chỉ giải mã trong bộ nhớ, bóc tách graph JSON, scrub sạch secret rồi mới lưu file graph đã làm sạch. File binary upload gốc bị huỷ.
2. **Lưu trữ Content-Addressed**: Các file graph và media lưu dưới dạng băm SHA-256:
   - Graph: `{STORAGE_DIR}/graphs/{2_hex_đầu}/{sha256}.json`
   - Media: `{STORAGE_DIR}/media/{2_hex_đầu}/{sha256}.png`
3. **Đóng gói lại theo cơ chế Template-Inject**: Thay vì lưu hàng chục file `.exe` cồng kềnh (mỗi file ~100MB), store giữ 1 template mini-app rỗng (`MINI_APP_TEMPLATE_PATH`). Khi tải về, server bơm file workflow graph đã scrub cùng khối cấu hình `store` vào template và nén zip trả cho người dùng.

---

## 3. Các Luồng Nghiệp Vụ Cốt Lõi (Core Workflows)

### 3.1 Luồng 1: Ingest & Tách Graph (Upload)
```
File .haup ──► parseMiniAppContainer (HAUP2) ──► extractPackage ──► scrubCredentials ──► deriveMetadata ──► Save DB
(Lớp A)       (X25519 + AES-256-GCM)            (Đọc workflow)    (Xóa token/pass)     (Đếm node, shell)
```
1. **Unwrap lớp A (HAUP2)**: Giải mã container mã hóa kép:
   - Private key X25519 (`MINI_APP_WRAPPER_PRIVATE_KEY`) kết hợp với `ephPub` tạo khóa dùng chung (ECDH).
   - Dùng HKDF-SHA256 sinh khóa AES-256-GCM.
   - Xác thực AAD ràng buộc `builderId\0appId` (ngăn sửa đổi header).
2. **Trích xuất (Extract)**: Đọc file `resources/app.workflow` (JSON) từ gói zip/exe bên trong. Kiểm tra đường dẫn entry chống **zip-slip**.
3. **Làm sạch (Scrub Credentials)**: Quét mọi thuộc tính khớp regex (`password|token|apikey|secret|privatekey|pass|pwd|_key`) trong node và mảng `variables[]`. Xóa trắng giá trị và ghi nhận vị trí vào `scan.credential_paths`.
4. **Suy biến siêu dữ liệu (Derive Metadata)**: Không tin dữ liệu từ form, hệ thống tự động quét graph để trích xuất:
   - `node_count`, `node_groups_used`
   - `capabilities`: `requires_browser`, `uses_shell` (`runCommand` - cờ cảnh báo an ninh), `uses_ai_llm`, `uses_2fa`, `uses_email`...
   - `required_variables`: Danh sách biến seller yêu cầu người mua điền (loại trừ biến mặc định như `profile_uuid`, `remote_port`...).
5. **Lưu trữ**: Script lưu ở trạng thái `DRAFT`, phiên bản ở `PENDING_REVIEW`.

---

### 3.2 Luồng 2: Kiểm Duyệt Bản Quyền (Admin Moderation)
- Admin vào `/admin` xem danh sách chờ duyệt, thông tin capabilities và báo cáo scan bảo mật.
- **Cổng chặn an ninh bắt buộc (Security Gate)**:
  - Nếu `scan.embedded_credentials_count > 0` $\rightarrow$ Nút duyệt bị khóa, API trả về **`409 Conflict` (`credentials_present`)**. Phiên bản này vĩnh viễn không thể duyệt; seller phải xóa và tải lên bản mới đã xóa secret.
  - Khi duyệt thành công: Phiên bản thành `APPROVED`, listing chuyển thành `PUBLISHED`.

---

### 3.3 Luồng 3: Cấp Phép Bản Quyền (Licensing & Activation)
```
Buyer nhập Key (SK-...) ──► POST /api/v1/app/keys/redeem ──► Cấp quyền vào seller_members
                                                                      │
Mini-app khởi động       ──► POST /api/v1/app/scripts/:id/license ◄───┘
                                   │
                           Xác thực token Flowdesk + MachineId (không bị chặn)
                                   │
                           Ký Ed25519 (Store Private Seed)
                                   │
Mini-app nhận licence    ◄── Trả về { payload_b64, signature, algorithm: "Ed25519" }
(Kiểm tra offline 7 ngày)
```

---

## 4. Đặc Tả Chi Tiết Request / Response (API Specifications)

### 4.1 Nhóm Xác Thực (Authentication)

#### `POST /api/v1/auth/login` (Seller / Admin đăng nhập)
- **Request**:
  ```json
  {
    "email": "seller@local.test",
    "password": "password123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "s-uuid",
      "email": "seller@local.test",
      "storeName": "HideAuto Official",
      "status": "APPROVED",
      "role": "SELLER"
    }
  }
  ```

---

### 4.2 Nhóm Kịch Bản & Tải Lên (Scripts / Seller)

#### `POST /api/v1/scripts/inspect` (Kiểm tra file thử nghiệm - Dry Run)
- **Headers**: `Authorization: Bearer <store_token>`, `Content-Type: multipart/form-data`
- **Request FormData**:
  - `file`: File nhị phân `.haup` (hoặc `.zip`, `.exe`, `.json`)
- **Response `200 OK`**:
  ```json
  {
    "appId": "com.hideflow.mini.gmail-warmup",
    "name": "Gmail Auto Warmup",
    "version": "1.0.0",
    "delivery": "mini_app_exe",
    "graphExtracted": true,
    "scan": {
      "embeddedCredentialsCount": 1,
      "credentialPaths": ["nodes[4].data.config.apiKey"]
    },
    "capabilities": {
      "requiresBrowser": true,
      "browserPlatforms": ["builtin", "gpmLogin"],
      "usesShell": false,
      "usesAiLlm": true,
      "aiProviders": ["openai"]
    },
    "requiredVariables": [
      { "key": "sheet_url", "label": "Google Sheet URL" }
    ],
    "nodeCount": 28
  }
  ```

---

#### `POST /api/v1/scripts` (Tạo kịch bản mới)
- **Headers**: `Authorization: Bearer <store_token>`, `Content-Type: multipart/form-data`
- **Request FormData**:
  - `file`: File `.haup` (bắt buộc)
  - `name`: Tên kịch bản (string)
  - `shortDescription`: Mô tả tóm tắt (string)
  - `description`: Nội dung chi tiết (string)
  - `version`: Phiên bản `"1.0.0"`
  - `tagIds`: Danh sách tag ID dạng chuỗi `"tag-1,tag-2"`
  - `minAppVersion`: Phiên bản desktop app tối thiểu (`"1.2.0"`)
- **Response `201 Created`**:
  ```json
  {
    "id": "script-uuid-1",
    "slug": "gmail-auto-warmup",
    "name": "Gmail Auto Warmup",
    "status": "DRAFT",
    "thumbnailUrl": "/api/v1/media/mini-apps/com.hideflow.mini.gmail-warmup/icon.png",
    "latestVersion": {
      "id": "version-uuid-1",
      "version": "1.0.0",
      "status": "PENDING_REVIEW",
      "graphExtracted": true,
      "scan": {
        "embeddedCredentialsCount": 0,
        "credentialPaths": []
      },
      "capabilities": {
        "requiresBrowser": true,
        "usesShell": false
      }
    }
  }
  ```

---

#### `POST /api/v1/scripts/{id}/submit` (Gửi duyệt kịch bản)
- **Headers**: `Authorization: Bearer <store_token>`
- **Response `200 OK`**:
  ```json
  {
    "id": "script-uuid-1",
    "status": "PENDING_REVIEW"
  }
  ```

---

### 4.3 Nhóm Quản Trị & Kiểm Duyệt (Admin)

#### `GET /api/v1/admin/scripts` (Hàng đợi kiểm duyệt version)
- **Headers**: `Authorization: Bearer <admin_token>`
- **Response `200 OK`**:
  ```json
  {
    "items": [
      {
        "id": "version-uuid-1",
        "version": "1.0.0",
        "scriptId": "script-uuid-1",
        "scriptName": "Gmail Auto Warmup",
        "seller": {
          "id": "seller-uuid",
          "storeName": "Automation Store"
        },
        "scan": {
          "embeddedCredentialsCount": 0,
          "credentialPaths": []
        },
        "capabilities": {
          "requiresBrowser": true,
          "usesShell": false
        },
        "createdAt": "2026-09-03T02:15:00.000Z"
      }
    ],
    "total": 1
  }
  ```

---

#### `PATCH /api/v1/admin/scripts/versions/{vid}/approve` (Duyệt kịch bản lên store)
- **Headers**: `Authorization: Bearer <admin_token>`
- **Phản hồi lỗi nếu còn credential (`409 Conflict`)**:
  ```json
  {
    "code": "credentials_present",
    "detail": "Không thể duyệt phiên bản vẫn còn credential nhúng trong graph"
  }
  ```
- **Response thành công `200 OK`**:
  ```json
  {
    "id": "version-uuid-1",
    "status": "APPROVED",
    "script": {
      "id": "script-uuid-1",
      "status": "PUBLISHED"
    }
  }
  ```

---

#### `PATCH /api/v1/admin/scripts/versions/{vid}/reject` (Từ chối duyệt)
- **Headers**: `Authorization: Bearer <admin_token>`
- **Request Body**:
  ```json
  {
    "reason": "Phát hiện node runCommand chạy script không rõ nguồn gốc."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "id": "version-uuid-1",
    "status": "REJECTED",
    "reviewNote": "Phát hiện node runCommand chạy script không rõ nguồn gốc."
  }
  ```

---

### 4.4 Nhóm Quản Lý Khóa & Thành Viên (Keys & Members)

#### `POST /api/v1/keys` (Phát hành khóa bản quyền)
- **Headers**: `Authorization: Bearer <store_token>`
- **Request Body**:
  ```json
  {
    "scriptId": "script-uuid-1", // Để null nếu là key mở toàn bộ shop
    "quantity": 2,              // Số lượng key cần tạo
    "maxUses": 1,               // Giới hạn số người dùng trên mỗi key
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "note": "Khách hàng đặt trước"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "keys": [
      {
        "id": "key-uuid-1",
        "key": "SK-7K9A2-BC89F-X21MN-PQ84D",
        "scriptId": "script-uuid-1",
        "maxUses": 1,
        "usesCount": 0,
        "expiresAt": "2026-12-31T23:59:59.000Z"
      },
      {
        "id": "key-uuid-2",
        "key": "SK-M38BN-55LA1-99CC0-88PL2",
        "scriptId": "script-uuid-1",
        "maxUses": 1,
        "usesCount": 0,
        "expiresAt": "2026-12-31T23:59:59.000Z"
      }
    ]
  }
  ```

---

#### `PATCH /api/v1/members/{memberId}/devices/{machineId}/block` (Chặn thiết bị)
- **Headers**: `Authorization: Bearer <store_token>`
- **Response `200 OK`**:
  ```json
  {
    "id": "member-uuid",
    "blockedDevices": ["HWID-8849-BFC2-1092"]
  }
  ```

---

### 4.5 Nhóm Dành Cho Mini-App Runtime & Buyer (`/api/v1/app/*`)

> **Yêu cầu xác thực**: Header `Authorization: Bearer <flowdesk_jwt_token>`

#### `POST /api/v1/app/keys/redeem` (Người dùng nạp key)
- **Request Body**:
  ```json
  {
    "key": "SK-7K9A2-BC89F-X21MN-PQ84D"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "ok": true,
    "scriptId": "script-uuid-1",
    "scriptName": "Gmail Auto Warmup",
    "allScripts": false
  }
  ```

---

#### `POST /api/v1/app/scripts/{scriptId}/license` (Kích hoạt & Cấp phép chạy)
- **Mục đích**: Mini-app gọi lúc mở để kiểm tra bản quyền và lấy chứng thực số offline.
- **Request Body**:
  ```json
  {
    "key": "SK-7K9A2-BC89F-X21MN-PQ84D", // Bắt buộc lần đầu, lần sau có thể bỏ trống
    "machine_id": "HWID-8849-BFC2-1092"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "payload_b64": "eyJmb3JtYXQiOjEsInNjcmlwdF9pZCI6InNjcmlwdC11dWlkLTEiLCJhcHBfaWQiOiJjb20uaGlkZWZsb3cubWluaS5nbWFpbC13YXJtdXAiLCJhcHBfbmFtZSI6IkdtYWlsIEF1dG8gV2FybXVwIiwic2VsbGVyX25hbWUiOiJBdXRvbWF0aW9uIFN0b3JlIiwidXNlcl9pZCI6ImZsb3dkZXNrLXVzci0xMjMiLCJ1c2VyX2VtYWlsIjoiYnV5ZXJAZXhhbXBsZS5jb20iLCJtYWNoaW5lX2lkIjoiSFdJRC04ODQ5LUJGQzItMTA5MiIsImlzc3VlZF9hdCI6IjIwMjYtMDktMDNUMDI6MDA6MDBaIiwiZXhwaXJlc19hdCI6IjIwMjYtMDktMTBUMDI6MDA6MDBaIn0=",
    "signature": "3u7Y6Hq2R...Ed25519SignatureBase64...",
    "algorithm": "Ed25519"
  }
  ```
- **Cấu trúc JSON sau khi giải mã `payload_b64`**:
  ```json
  {
    "format": 1,
    "script_id": "script-uuid-1",
    "app_id": "com.hideflow.mini.gmail-warmup",
    "app_name": "Gmail Auto Warmup",
    "seller_name": "Automation Store",
    "user_id": "flowdesk-usr-123",
    "user_email": "buyer@example.com",
    "machine_id": "HWID-8849-BFC2-1092",
    "issued_at": "2026-09-03T02:00:00Z",
    "expires_at": "2026-09-10T02:00:00Z"
  }
  ```

---

#### `GET /api/v1/app/scripts/{scriptId}/download?format=exe|graph` (Tải bản build)
- **Response**: Trả về luồng file nhị phân (Binary Stream):
  - `Content-Type`: `application/zip` (nếu format=exe) hoặc `application/json` (nếu format=graph)
  - `Content-Disposition`: `attachment; filename="gmail-auto-warmup.zip"`

---

### 4.6 Nhóm Truy Xuất Tĩnh & Media (Public Media Serve)

#### `GET /api/v1/media/{*ref}`
- **Xác thực**: Public (Không cần token).
- **Ví dụ đường dẫn**:
  - Icon: `GET /api/v1/media/mini-apps/com.hideflow.mini.gmail-warmup/icon.png`
  - Setup installer: `GET /api/v1/media/mini-apps/com.hideflow.mini.gmail-warmup/1.0.0/gmail-warmup-setup.exe`
- **Response Headers**:
  - `Content-Type`: `image/png` đối với icon, `application/octet-stream` đối với `.exe`
  - `Content-Disposition`: `attachment; filename="..."` (bắt buộc cho `.exe` để trình duyệt không chặn)
  - `Cache-Control`: `public, max-age=31536000, immutable`

---

## 5. Bảng Mã Lỗi Hệ Thống (System Error Codes)

Tất cả các exception nghiệp vụ được chuẩn hóa bởi `HttpExceptionFilter` theo định dạng:
```json
{
  "code": "error_code_string",
  "detail": "Mô tả chi tiết nguyên nhân gây lỗi"
}
```

| HTTP Status | Mã lỗi `code` | Ngữ cảnh xuất hiện & Cách xử lý |
|---|---|---|
| **400 Bad Request** | `wrapper_bad_magic` | File tải lên không có header magic `HAUP2`. |
| **400 Bad Request** | `wrapper_decrypt_failed` | Giải mã thất bại: sai key X25519, file hỏng, hoặc header AAD bị sửa. |
| **400 Bad Request** | `wrapper_key_missing` | Server chưa cấu hình biến môi trường `MINI_APP_WRAPPER_PRIVATE_KEY`. |
| **400 Bad Request** | `wrapper_invalid` | Thiếu trường bắt buộc trong outer/inner header JSON. |
| **403 Forbidden** | `seller_not_approved` | Tài khoản seller chưa ở trạng thái `APPROVED` nhưng cố đăng script/tạo key. |
| **403 Forbidden** | `key_required` | Buyer chưa sở hữu kịch bản và không gửi key $\rightarrow$ Mini-app bật popup nhập key. |
| **403 Forbidden** | `device_blocked` | Máy tính (`machine_id`) nằm trong danh sách chặn của người bán. |
| **403 Forbidden** | `key_wrong_app` | Mã key hợp lệ nhưng thuộc về mini-app khác. |
| **403 Forbidden** | `script_not_published` | Kịch bản đã bị gỡ hoặc lưu trữ. |
| **404 Not Found** | `key_not_found` | Mã key không tồn tại trong hệ thống hoặc đã bị thu hồi (`REVOKED`). |
| **409 Conflict** | `credentials_present` | Admin duyệt phiên bản còn chứa credentials (`embedded_credentials_count > 0`). |
| **409 Conflict** | `version_exists` | Upload phiên bản đã tồn tại trên kịch bản (`scriptId`, `version`). |
| **422 Unprocessable** | `hideflow_encrypted` | Seller nộp file `.hideflow` mã hóa (cần nộp container `.haup`). |
| **503 Service Unavailable** | `licensing_unconfigured`| Server thiếu biến môi trường `LICENSE_SIGNING_KEY` khi cấp licence. |

# Script Publish & Mini-app Packaging

Tài liệu chi tiết cho luồng **seller đăng script → store tách/validate → buyer tải (đóng gói lại)**.
Nguồn sự thật về data: [server/prisma/schema.prisma](../server/prisma/schema.prisma). Cơ chế mini-app tham chiếu code app
`desktop-app-workflow/src/main/mini-app/mini-app-build-service.ts`.

> **Tóm tắt 1 dòng**: seller upload **gói mini-app `.exe`/`.zip`** (hoặc `.hideflow`) → store **tách workflow graph**
> ra → **scrub credential + derive metadata** → lưu & duyệt → khi buyer tải, store **đóng gói lại** `.exe`.

> **Trạng thái**: upload → tách graph → scrub → derive → duyệt **đã chạy** trên server NestJS
> (`server/src/common/graph/`, gate 409 khi còn credential). **Đóng gói lại `.exe` chưa port** —
> `POST /scripts/:scriptId/builds` mới chỉ ghi bản ghi build, chưa sinh installer.

---

## 1. Artifact — script trông như thế nào

### 1.1 Workflow graph (lõi)
Mọi script thực chất là 1 **graph JSON**:

```jsonc
{ "nodes": [...], "edges": [...], "variables": [{ "id","key","value" }], "viewport": {"x","y","zoom"} }
```

- ~75 loại node, 8 nhóm (browser, tab, element, keyboard, mouse, data, debug, ai).
- Biến tham chiếu trong chuỗi dạng `{{key}}`. **Biến built-in luôn có** (bỏ khi tính "biến cần điền"):
  `profile_uuid`, `profile_path`, `remote_port`, `remote_ws`.
- Node `runOtherScript` → script **phụ thuộc** script khác (ghi lại thành `sub_script_ids`).

### 1.2 Hai vỏ chứa graph
| Vỏ | Định dạng | Mã hoá | Ghi chú |
|---|---|:--:|---|
| **`.hideflow`** (export) | payload `{ id, data(graph), exportedAt, appVersion }` | ✅ (HFLW…) | Giải mã bằng key cố định của app (`workflow-crypto`). Có `appVersion`. |
| **Mini-app** (`.exe` + `resources/app.workflow`) | `app.workflow` = JSON thường | ❌ | **Dễ tách** — chỉ cần đọc file. Không có `appVersion`. |

**`resources/app.workflow`** (JSON thường, do app ghi ra khi build):
```jsonc
{
  "version": 1,
  "appName": "Gmail Auto Register",
  "appId": "com.hideflow.mini.gmail-auto-register",
  "workflowId": "wf-...",
  "workflowName": "Gmail Auto Register",
  "builtAt": "2026-08-14T...Z",
  "iconFileName": "mini-app-icon.ico",
  "workflow": { /* graph: nodes/edges/variables/viewport */ }
}
```

### 1.3 Mini-app được app build ra sao (để hiểu vì sao server không build full được)
`buildMiniApp()` trong app:
1. **Chỉ chạy khi app đã đóng gói** (`app.isPackaged`).
2. **Copy nguyên thư mục cài Electron** sang thư mục đích (dùng `original-fs`, kiểm tra toàn vẹn `resources/app.asar`).
3. Ghi `resources/app.workflow` = `JSON.stringify(embedded, null, 2)`.
4. Đổi tên exe + **`rcedit`** vá **tên/icon** exe (Windows), icon `.png`→`.ico` bằng `png-to-ico`.

⇒ Full build cần **Electron runtime + rcedit + Windows** → **server FastAPI (Linux) không làm được y hệt**. Xem [§4](#4-đóng-gói-lại-repackage).

---

## 2. Luồng Upload → Publish

```
Upload (.exe/.zip/.hideflow)
   │
   ├─ 2.1 Nhận dạng & tách graph
   ├─ 2.2 Scrub credential   ── còn secret? → CHẶN publish
   ├─ 2.3 Derive metadata (quét graph)
   ├─ 2.4 Lưu uploads + scripts + script_versions (pending_review)
   └─ 2.5 Admin duyệt → published
```

### 2.1 Nhận dạng & tách graph
- **`.exe`/`.zip`**: giải nén → đọc `resources/app.workflow` → `JSON.parse` → lấy field `workflow` (= graph).
  Lưu gói gốc thành `uploads(kind=mini_app_source)`.
  ⚠️ **Bảo mật giải nén**: chống **zip-slip** (chuẩn hoá đường dẫn, chặn `..`), giới hạn kích thước & số entry.
- **`.hideflow`**: giải mã bằng key app → `{ data(graph), appVersion }`. Lưu `uploads(kind=hideflow)`.
- Graph đã tách lưu thành `uploads(kind=workflow_graph)` → chính là `script_versions.file_id`.

### 2.2 Scrub credential (bắt buộc)
Quét toàn bộ field trong graph theo pattern (khớp app `detectExportCredentials`):
`password | token | apikey | secret | privatekey | pass | pwd | _key`.
- Ghi `scan.embedded_credentials_count` + `scan.credential_paths[]`.
- **Nếu > 0 → chặn publish**, trả danh sách vị trí để seller xoá. `published` bắt buộc = 0.

### 2.3 Derive metadata (KHÔNG tin seller — quét graph)
| Trường | Cách suy ra |
|---|---|
| `node_count`, `node_groups_used` | đếm `data.code` của node theo catalog/nhóm |
| `uses_control_flow` | có node `if / ifElse / loop` |
| `sub_script_ids` | node `runOtherScript` → `workflowId` phụ thuộc |
| `capabilities.requires_browser` + `browser_platforms` | node `openConnect` (`hidemium/adspower/gpmLogin/builtin`) |
| `capabilities.requires_proxy` | `openConnect` bật proxy |
| `capabilities.uses_fingerprint` | khối `openConnectFingerprint*` |
| `capabilities.uses_ai_llm` + `ai_providers` | node `aiLlm` (`openai/claude/gemini/ollama/qwen`) |
| `capabilities.uses_email` | node SMTP/IMAP/Hotmail/Outlook OAuth |
| `capabilities.uses_google_sheets` | node spreadsheet nguồn Google |
| `capabilities.uses_2fa` | node `getCode2Fa` (TOTP) |
| **`capabilities.uses_shell`** ⚠️ | node `runCommand` — **cờ bảo mật, hiển thị nổi bật** |
| `required_variables` | `variables[]` **trừ** built-in (`profile_uuid/profile_path/remote_port/remote_ws`) |
| `min_app_version` / `tested_app_version` | từ `.hideflow.appVersion`. Gói `.exe` **không có** → seller khai báo, hoặc để trống |

### 2.4 Lưu
- `scripts` (denormalize field để browse/filter) + `script_versions` (chi tiết đầy đủ) + `uploads` (các file).
- `script_versions.status = pending_review`; `uploads.status = pending_scan → clean` sau khi quét an toàn.

### 2.5 Duyệt
- Admin xem scan + `uses_shell` → `approved` (cập nhật `scripts.latest_version_id`, copy denormalize, `scripts.status = published`)
  hoặc `rejected` (kèm `reason`, giữ bản cũ).

---

## 3. Versioning
- Mỗi lần seller upload bản mới → **1 `script_versions` mới** (`pending_review`), **quét & duyệt lại từ đầu** (upload = untrusted).
- `approved` ⇒ trỏ `scripts.latest_version_id` sang bản mới; bản cũ vẫn giữ trong lịch sử.
- `script_versions` giữ `source_upload_id` (gói gốc) + `file_id` (graph đã tách) cho từng bản.

---

## 4. Đóng gói lại (Repackage)

Store **không giữ mãi file .exe khổng lồ**; nó giữ **graph nhỏ** rồi đóng gói lại khi cần.

### 4.1 Server template-inject (mặc định — **đã code**)
1. Store giữ sẵn **1 "template mini-app rỗng"** (bản app đã đóng gói, chưa có workflow) — nạp 1 lần / mỗi platform.
2. Khi tải: **copy template** → ghi `resources/app.workflow` (graph đã tách, có thể chèn `appName/appId` riêng) → **zip**.
3. Trả file cho buyer.

- ✅ Thuần thao tác file → chạy trên server Linux, không cần Electron/rcedit.
- ❌ **Không đổi được tên/icon `.exe`** (đó là việc của `rcedit`/Windows).
- Bản ghi: `mini_app_builds` với `built_by = "server"`.

### 4.2 Build-agent Windows (tùy chọn — full identity)
- 1 worker Windows chạy app hideflow (hoặc script tương đương) để build thật: `rcedit` đổi tên/icon exe.
- Giống hệt build trong app; cần dựng thêm hạ tầng (hàng đợi build + máy Windows).
- Bản ghi: `mini_app_builds` với `built_by = "agent"`.

### 4.3 Lựa chọn khác
- Chỉ trả **`.hideflow`** (graph) để buyer **import** vào app hideflow của họ — đơn giản nhất, không build.

---

## 5. Ánh xạ data model
Chi tiết trường: [server/prisma/schema.prisma](../server/prisma/schema.prisma).

| Collection | Vai trò trong luồng này |
|---|---|
| `uploads` | file vật lý: `mini_app_source` (gói gốc), `workflow_graph` (graph tách), `hideflow`, `mini_app_build` (bản đóng gói lại), media. Có `checksum` + `status` (scan an toàn). |
| `scripts` | listing (denormalize: capabilities, node_count, min_app_version, stats…). |
| `script_versions` | mỗi bản: `file_id`(graph), `source_upload_id`(gói gốc), `scan`, `capabilities`, `required_variables`, `status`. |
| `mini_app_builds` | bản đóng gói lại theo platform/arch; `built_by = server|agent`; trỏ `file_id → uploads`. |

---

## 6. Endpoint

Đã code (`server/src/scripts/scripts.controller.ts`, prefix `/api/v1`):

| Method · Path | Việc |
|---|---|
| `POST /sellers/me/scripts` | multipart (`file` + form) → tách + scrub + derive → script `draft` + version `pending_review` |
| `POST /sellers/me/scripts/{id}/versions` | upload bản mới (quét & duyệt lại từ đầu) |
| `POST /sellers/me/scripts/{id}/submit` | gửi duyệt (`draft`/`rejected` → `pending_review`) |
| `GET /sellers/me/scripts` · `/{id}` | liệt kê / chi tiết (capabilities, versions, scan, moderation) |
| `GET /admin/scripts` · `/{id}` | hàng đợi duyệt |
| `POST /admin/scripts/{id}/versions/{vid}/approve` | duyệt → publish (**chặn nếu còn secret**) |
| `POST /admin/scripts/{id}/versions/{vid}/reject` | từ chối kèm `reason` |
| `POST /sellers/me/scripts/{id}/keys` · `GET …/keys` | phát hành / liệt kê khóa **mở đúng 1 mini app** |
| `POST /sellers/me/scripts/{id}/mini-app-builds` | đóng gói lại `.zip` (server template inject) |
| `GET /sellers/me/scripts/{id}/mini-app-builds` | liệt kê bản đóng gói |
| `GET /sellers/me/scripts/{id}/download?format=graph\|exe` | seller tải artifact của chính mình |
| `GET /app/scripts` | end-user liệt kê mini app **đã mở khóa** |
| `GET /app/scripts/{id}/download?format=exe\|graph` | end-user tải (kiểm tra entitlement) |
| `POST /app/scripts/{id}/license` | **mini app kích hoạt**: `{key?, machine_id}` → licence đã ký |

### 6.2 Khóa & quyền truy cập

- `seller_keys.script_id` = mini app mà khóa mở. `null` = khóa toàn shop (khóa cũ, mở mọi app).
- Redeem khóa → `seller_members.script_ids` thêm app đó (`all_scripts = true` với khóa toàn shop).
  Cùng 1 user redeem nhiều khóa của cùng seller ⇒ vẫn 1 membership, cộng dồn danh sách app.
- Tải về yêu cầu: script `published` + membership `active` + app nằm trong entitlement.

### 6.3 Kích hoạt mini app bằng key

Khóa ở trên mới mở **quyền tải**. Muốn khóa cả **quyền chạy** gói đã tải thì gói phải tự kiểm
licence: store ký, mini app verify. Gói đóng ra vì thế mang thêm khối `store`
(`baseUrl`, `scriptId`, `licensePublicKey`…) trong `resources/app.workflow`, và mini app gọi
`POST /app/scripts/{id}/license` để đổi key lấy licence.

Chi tiết đầy đủ (định dạng licence, mã lỗi, cấu hình, phần còn phải làm ở app):
**[mini-app-licensing.md](./mini-app-licensing.md)**.

### 6.1 Khác biệt so với thiết kế ban đầu (đã code thế này)

- **`.hideflow` mã hoá chưa nhận** — key giải mã nằm trong app, server không có. Upload `.hideflow`
  trả 422 kèm thông báo rõ. Nhận: gói mini-app `.zip`/`.exe` (thực chất là zip) và file
  `app.workflow` / graph `.json`.
- **Không lưu gói gốc.** Gói `.exe`/`.zip` chứa nguyên secret của seller và rất nặng, nên store
  **chỉ lưu graph đã scrub**; version giữ `source_filename` + `source_checksum` để truy vết.
  (Đúng tinh thần [§7](#7-bảo-mật-nhắc-lại--quan-trọng) và guardrail "không bao giờ lưu secret".)
  ⇒ `script_versions.source_upload_id` / `uploads(kind=mini_app_source)` hiện không dùng.
- **`sub_script_ids` → `sub_workflow_ids`** (`array<string>`): node `runOtherScript` chỉ có
  `workflowId` phía app, không map được sang `_id` của store.
- **`category_id` / `tag_ids` optional** — collection `categories` / `tags` chưa dựng.
- **Scrub + derive chạy trong threadpool** (`asyncio.to_thread`) và **trước khi ghi DB**, nên
  upload hỏng không để lại script rỗng.
- **Lưu file**: content-addressed theo sha256 dưới `STORAGE_DIR` (`uploads.storage = local`).

---

## 7. Bảo mật (nhắc lại — quan trọng)
- **Upload là untrusted**: quét file (AV/parse), `uploads.status=clean` mới dùng.
- **Giải nén an toàn**: chống zip-slip, giới hạn dung lượng/entry.
- **Scrub credential**: chặn publish nếu còn secret; không bao giờ trả secret ra ngoài.
- **`uses_shell` (`runCommand`)**: cờ đỏ, hiển thị rõ cho buyer + admin.
- **Không tin metadata seller**: mọi thứ suy ra từ graph.
- **Kích thước**: giới hạn upload; `.exe` gói to → cân nhắc chỉ giữ graph + template thay vì lưu nhiều gói.

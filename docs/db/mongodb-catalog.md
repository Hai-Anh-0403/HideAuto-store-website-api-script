# MongoDB — Catalog Schema (storeAutoHide)

> **Sản phẩm = script automation** (workflow `.hideflow`) cho app **hideflow**
> (Electron, canvas node-based, chạy Playwright/CDP trên anti-detect browser: Hidemium/AdsPower/GPMLogin).
> Store dùng collection `scripts` first-class.
>
> Phần **làm bây giờ**. MongoDB giữ **catalog + file**. **KHÔNG có payment/commerce** ở đây
> (không price, không sales, không coupon) — nếu sau này bán thì tách sang lớp giao dịch riêng (SQL).
> User để **SQL, làm sau** — xem [sql-schema.md](./sql-schema.md).
>
> **Cross-DB boundary**: `seller.id` / `user_id` / `owner_id` là **ref sang SQL** (`users.id`), lưu string —
> không join cứng. SQL lưu `script_id` = `scripts._id` (hex 24). Denormalize `seller` để khỏi tra chéo khi hiển thị.

Stack: FastAPI + MongoDB (PyMongo async + Beanie ODM) + Pydantic v2.

Collections:
1. [`categories`](#1-categories)
2. [`tags`](#2-tags)
3. [`scripts`](#3-scripts) ⭐ — chỉ field browse/filter + con trỏ version mới nhất
4. [`script_versions`](#4-script_versions) — nội dung đầy đủ + lịch sử + artifact
5. [`reviews`](#5-reviews)
6. [`uploads`](#6-uploads)
7. [`mini_app_builds`](#7-mini_app_builds)

Quy ước: mọi doc có `_id: ObjectId`, `created_at` / `updated_at: datetime (UTC)`.
Nguyên tắc tối ưu: **`scripts` chỉ chứa thứ cần để liệt kê/lọc**; chi tiết nặng nằm ở `script_versions`, đọc khi mở trang script.

---

## 1. `categories`
Cây danh mục (theo use-case: tạo tài khoản, warm-up, scraping, auto-post…).

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `slug` | string (unique) | ✓ | `account-creation`, `warmup`, `scraping` |
| `name` | string | ✓ | tên hiển thị |
| `parent_id` | ObjectId \| null | | danh mục cha (null = gốc) |
| `icon` / `order` | string / int | | hiển thị |
| `script_count` | int (default 0) | | denormalize: số script published |
| `created_at` / `updated_at` | datetime | ✓ | |

**Indexes**: `slug` (unique), `parent_id`.

---

## 2. `tags`
Master list — multi-select khi tạo script; nhóm tag để lọc UI.

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `slug` | string (unique) | ✓ | |
| `name` | string | ✓ | hiển thị |
| `group` | string \| null | | nhóm lọc: `platform` \| `use-case` \| `difficulty`… |
| `usage_count` | int (default 0) | | denormalize: số script dùng |
| `created_at` / `updated_at` | datetime | ✓ | |

**Indexes**: `slug` (unique), `group`.

---

## 3. `scripts` ⭐
Listing tối giản — **chỉ field để browse/filter** + con trỏ tới bản mới nhất.
Chi tiết đầy đủ (biến cần điền, phụ thuộc, scan…) lấy từ [`script_versions`](#4-script_versions).

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `slug` | string (unique) | ✓ | |
| `name` | string | ✓ | |
| `short_description` | string | | cho card |
| `description` | string (markdown) | | mô tả dài |
| `category_id` | ObjectId | ✓ | → `categories` |
| `tag_ids` | array\<ObjectId\> | | → `tags` (multi-select) |
| **`seller`** | object | ✓ | denormalize — `{ id: string (ref SQL users.id), name, avatar? }` |
| `media` | array\<object\> | | `{ upload_id?: ObjectId → uploads, url?, type: "image"｜"video", order }` |
| `thumbnail` | object \| null | | `{ upload_id? → uploads, url? }` |
| `engine` | string | ✓ | cố định `"hideflow"` |
| `has_mini_app` | bool (default false) | | có bản build mini-app (→ `mini_app_builds`) |
| **`latest_version`** | string | | semver bản hiện hành |
| **`latest_version_id`** | ObjectId \| null | | → `script_versions` (bản published) |
| **`min_app_version`** | string | | denormalize (filter) |
| **`node_count`** | int | | denormalize (auto scan) |
| **`node_groups_used`** | array\<string\> | | denormalize — `browser/tab/element/data…` |
| **`capabilities`** | object | | denormalize (filter) — xem dưới, gồm cờ `uses_shell` |
| **`status`** | enum | ✓ | `draft` \| `pending_review` \| `published` \| `rejected` \| `archived` |
| **`stats`** | object | | `{ rating_avg, rating_count, downloads, views }` (denormalize) |
| `created_at` / `updated_at` | datetime | ✓ | |
| `published_at` | datetime \| null | | |

**`capabilities`** (auto-derive khi scan graph — dùng để lọc):
```jsonc
{
  "requires_browser": true,
  "browser_platforms": ["hidemium", "adspower", "gpmLogin", "builtin"],
  "requires_proxy": true,
  "uses_fingerprint": true,
  "uses_ai_llm": false,
  "ai_providers": [],           // openai | claude | gemini | ollama | qwen
  "uses_email": false,
  "uses_google_sheets": false,
  "uses_filesystem": true,
  "uses_2fa": false,
  "uses_shell": false           // ⚠ node runCommand — cờ bảo mật, hiện nổi bật trên listing
}
```

**Indexes**: `slug` (unique), `category_id`, `tag_ids` (multikey), `status`, `seller.id`,
`capabilities.browser_platforms` (multikey), `capabilities.uses_shell`, `min_app_version`,
`stats.rating_avg`, text(`name`, `short_description`, `description`).

---

## 4. `script_versions`
Nội dung đầy đủ + lịch sử. Mỗi lần seller upload bản mới → 1 doc, scan & duyệt lại (upload = untrusted).
Đây là nơi giữ mọi field chi tiết (không lặp lên `scripts`).

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `script_id` | ObjectId | ✓ | → `scripts` |
| `version` | string (semver) | ✓ | |
| `changelog` | string | | |
| **`file_id`** | ObjectId | ✓ | → `uploads` (kind `workflow_graph`) — **graph đã tách** của bản này |
| `source_upload_id` | ObjectId \| null | | → `uploads` (kind `mini_app_source`) — gói `.exe`/`.zip` gốc seller upload |
| `delivery` | enum | ✓ | `hideflow_encrypted` \| `graph_json` \| `mini_app_exe` |
| `format_version` | int | ✓ | schema version do store đặt (app chưa có) |
| `min_app_version` / `tested_app_version` | string | | từ `appVersion` export payload |
| `node_count` | int | | scan graph |
| `node_groups_used` | array\<string\> | | |
| `uses_control_flow` | bool | | có if/ifElse/loop |
| `sub_script_ids` | array\<ObjectId\> | | node `runOtherScript` → script phụ thuộc |
| `capabilities` | object | | như cấu trúc ở `scripts` |
| `required_variables` | array\<object\> | | `{ key, label, example }` (biến non-builtin buyer phải điền) |
| `scan` | object | | `{ embedded_credentials_count, credential_paths[], uses_shell }` |
| **`status`** | enum | ✓ | `pending_review` \| `approved` \| `rejected` |
| `moderation` | object | | `{ reviewed_by, reviewed_at, reason, scanned_at }` |
| `released_at` / `created_at` | datetime | ✓ | |

**Indexes**: unique(`script_id`, `version`), `script_id`, `status`.

> **Luồng version + duyệt**: upload file → tạo `uploads` (`pending_scan`) + `script_versions` (`pending_review`)
> → parse + scrub + scan + derive → admin duyệt. `approved` ⇒ cập nhật `scripts.latest_version_id`/`latest_version`
> + copy phần denormalize (`min_app_version`, `node_count`, `node_groups_used`, `capabilities`) sang `scripts`,
> `scripts.status=published`. `rejected` ⇒ giữ bản cũ. `scan.embedded_credentials_count` phải = 0 mới được approve.

---

## 5. `reviews`
Đánh giá script.

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `script_id` | ObjectId | ✓ | → `scripts._id` |
| `user_id` | string | ✓ | **ref SQL** `users.id` |
| `rating` | int (1–5) | ✓ | |
| `comment` | string | | |
| `created_at` / `updated_at` | datetime | ✓ | |

**Indexes**: `script_id`, `user_id`, unique(`script_id`, `user_id`) chặn review trùng.

---

## 6. `uploads`
Đăng ký mọi file đã upload: artifact `.hideflow`, media (ảnh/video), thumbnail, file cài mini-app.
Tách riêng để quản lý storage, checksum, và **scan an toàn** (nhất là `.exe`, `.hideflow`).

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `owner_id` | string | ✓ | **ref SQL** `users.id` — người upload |
| `kind` | enum | ✓ | `mini_app_source` (gói .exe/.zip seller upload) \| `workflow_graph` (graph đã tách) \| `hideflow` (file .hideflow mã hoá) \| `media_image` \| `media_video` \| `thumbnail` \| `mini_app_build` (bản đóng gói lại) |
| `storage` | enum | ✓ | `gridfs` \| `s3` \| `local` |
| `ref` | string | ✓ | gridfs id / s3 key / path |
| `url` | string \| null | | public URL nếu có (CDN) |
| `filename` | string | ✓ | tên gốc |
| `mime_type` | string | ✓ | |
| `size_bytes` | int | ✓ | |
| `checksum` | string (sha256) | | integrity + dedupe |
| `status` | enum | ✓ | `pending_scan` \| `clean` \| `quarantined` \| `rejected` |
| `scan` | object | | `{ scanned_at, result, note }` — AV/parse check |
| `linked_to` | object \| null | | back-ref: `{ type: "script_version"｜"mini_app_build"｜"script", id: ObjectId }` |
| `created_at` / `updated_at` | datetime | ✓ | |

**Indexes**: `owner_id`, `kind`, `status`, `checksum`, `linked_to.id`.

> File chỉ được dùng (link vào version/build/media) sau khi `status=clean`.

---

## 7. `mini_app_builds`
Bản **đóng gói lại** thành mini-app (`.exe`/zip) từ graph đã tách của 1 script version.

> **Cơ chế (từ app)**: mini-app = thư mục app Electron + `resources/app.workflow` (**JSON thường**, không mã hoá):
> `{ version, appName, appId, workflowId, workflowName, builtAt, iconFileName, workflow: <graph> }`.
> **Extract**: đọc `app.workflow` → lấy `workflow` (graph) → scrub + derive.
> **Repackage (server)**: chép **template mini-app rỗng** + ghi `resources/app.workflow` + zip →
> chạy được trên server, nhưng **không đổi tên/icon exe** (cần `rcedit`/Windows → để build-agent sau).
> `built_by`: `server` (template inject) \| `agent` (Windows, full identity).

| field | type | required | mô tả |
|---|---|:--:|---|
| `_id` | ObjectId | ✓ | |
| `script_id` | ObjectId | ✓ | → `scripts` |
| `script_version_id` | ObjectId | ✓ | → `script_versions` (build từ bản nào) |
| `app_id` | string | ✓ | mini-app `appId` |
| `app_name` | string | ✓ | |
| `app_version` | string (semver) | ✓ | version riêng của mini-app |
| `platform` | enum | ✓ | `win` \| `mac` \| `linux` |
| `arch` | enum | ✓ | `x64` \| `arm64` |
| `installer_format` | enum | ✓ | `exe` \| `dmg` \| `appimage` \| `zip` |
| `file_id` | ObjectId | ✓ | → `uploads` — file cài đặt |
| `icon_file_id` | ObjectId \| null | | → `uploads` — icon |
| `size_bytes` | int | | |
| `checksum` | string (sha256) | | |
| `status` | enum | ✓ | `building` \| `ready` \| `failed` |
| `built_by` | enum | ✓ | `server` (template inject) \| `agent` (Windows full) |
| `built_at` | datetime | | |
| `created_at` / `updated_at` | datetime | ✓ | |

**Indexes**: `script_id`, `script_version_id`,
unique(`script_version_id`, `platform`, `arch`, `app_version`), `status`.

---

## Quan hệ

```
categories       1 ──N scripts
tags             N ──N scripts               (scripts.tag_ids)
scripts          1 ──N script_versions       (scripts.latest_version_id → bản published)
scripts          1 ──N reviews
scripts          1 ──N mini_app_builds
script_versions  1 ──N mini_app_builds       (build từ 1 version)
uploads          1 ──1 script_versions.file_id / mini_app_builds.file_id / scripts.media[]
scripts          N ──(seller.id, string)──> SQL users
reviews          N ──(user_id, string)──> SQL users
uploads          N ──(owner_id, string)──> SQL users
script_versions  N ──(sub_script_ids)──> scripts   (phụ thuộc runOtherScript)
```

## Ghi chú
- **Không payment/commerce** trong Mongo: không `pricing`/`price`, không `sales_count`, không `coupons`, không `verified_purchase`. Việc bán (nếu có) tách sang lớp giao dịch SQL sau.
- **`scripts` tối giản**: chỉ field liệt kê/lọc + con trỏ version; chi tiết nặng chỉ nằm ở `script_versions` (không lặp).
- **Không tin metadata seller**: `node_count`, `capabilities`, `required_variables`, `sub_script_ids` **derive từ graph** khi scan.
- **Bảo mật**: file phải `clean` mới dùng; chặn approve nếu còn secret (`scan.embedded_credentials_count > 0`); nêu bật `uses_shell`.
- **Đã bỏ** loại `plan`/`proxy`/`account`. Muốn bán thêm về sau → tạo collection riêng.

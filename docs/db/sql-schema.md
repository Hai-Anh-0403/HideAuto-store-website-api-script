# SQL — User & Transaction Schema (storeAutoHide)

> Phần **làm sau** (từ từ). SQL giữ **user + giao dịch**; catalog nằm ở MongoDB —
> xem [mongodb-catalog.md](./mongodb-catalog.md).
>
> **Cross-DB boundary**: các cột trỏ tới sản phẩm (`script_id`…) là **reference sang MongoDB**
> (`scripts._id`, dạng hex 24 ký tự) — lưu `VARCHAR(24)`, **không** có FK cứng qua DB.
> Snapshot lại `name`/`price` khi tạo order để dữ liệu lịch sử không đổi.
>
> ⚠️ Store hiện **chỉ bán script** (đã bỏ loại `plan`/`proxy`/`account`). Vì vậy `subscriptions` (điểm 6)
> đang **để ngỏ** — chỉ giữ nếu về sau bán "gói truy cập"; nếu chỉ bán script one-time thì có thể bỏ bảng này.

Stack (dự kiến): PostgreSQL + SQLAlchemy 2.0 (async) + Alembic.
Quy ước: `id UUID PK` (default `gen_random_uuid()`), `created_at`/`updated_at TIMESTAMPTZ`.

Tables:
1. [`users`](#1-users)
2. [`user_addresses`](#2-user_addresses)
3. [`carts`](#3-carts) / [`cart_items`](#4-cart_items)
4. [`orders`](#5-orders) / [`order_items`](#6-order_items)
5. [`payments`](#7-payments)
6. [`subscriptions`](#8-subscriptions)
7. [`entitlements`](#9-entitlements)

---

## 1. `users`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | đăng nhập |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt — không trả ra API |
| `full_name` | VARCHAR(255) | | |
| `role` | ENUM `user_role` | NOT NULL, default `customer` | `customer` \| `seller` \| `admin` |
| `status` | ENUM `user_status` | NOT NULL, default `pending` | `active` \| `banned` \| `pending` |
| `email_verified` | BOOLEAN | NOT NULL, default false | |
| `wallet_balance` | NUMERIC(12,2) | NOT NULL, default 0 | ví nội bộ (nếu dùng) |
| `created_at` / `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Index**: unique(`email`).

## 2. `user_addresses`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE | |
| `full_name` | VARCHAR(255) | | |
| `line1` / `line2` | VARCHAR(255) | | |
| `city` / `country` | VARCHAR(100) | | |
| `postal_code` | VARCHAR(20) | | |
| `tax_id` | VARCHAR(50) | | |
| `is_default` | BOOLEAN | default false | |

**Index**: (`user_id`).

## 3. `carts`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, UNIQUE | 1 cart / user |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

## 4. `cart_items`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `cart_id` | UUID | FK → `carts.id` ON DELETE CASCADE | |
| `script_id` | VARCHAR(24) | NOT NULL | **ref Mongo** `scripts._id` |
| `name_snapshot` | VARCHAR(255) | | tên lúc thêm |
| `unit_price` | NUMERIC(12,2) | NOT NULL | |
| `qty` | INT | NOT NULL, CHECK > 0 | |
| `billing_cycle` | ENUM `billing_cycle` | | `monthly` \| `yearly` \| `one_time` |

**Index**: (`cart_id`).

## 5. `orders`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `order_no` | VARCHAR(30) | UNIQUE, NOT NULL | mã hiển thị |
| `user_id` | UUID | FK → `users.id` | |
| `subtotal` | NUMERIC(12,2) | NOT NULL | |
| `discount` | NUMERIC(12,2) | NOT NULL, default 0 | |
| `tax` | NUMERIC(12,2) | NOT NULL, default 0 | |
| `total` | NUMERIC(12,2) | NOT NULL | |
| `currency` | VARCHAR(3) | NOT NULL, default `USD` | |
| `status` | ENUM `order_status` | NOT NULL, default `pending` | `pending` \| `paid` \| `failed` \| `refunded` \| `cancelled` |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `paid_at` | TIMESTAMPTZ | | |

**Index**: unique(`order_no`), (`user_id`), (`status`).

## 6. `order_items`
Snapshot tại thời điểm mua (không đổi theo catalog).

| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `order_id` | UUID | FK → `orders.id` ON DELETE CASCADE | |
| `script_id` | VARCHAR(24) | NOT NULL | **ref Mongo** `scripts._id` |
| `script_version` | VARCHAR(20) | | version đã mua (snapshot) |
| `name` | VARCHAR(255) | NOT NULL | snapshot |
| `unit_price` | NUMERIC(12,2) | NOT NULL | snapshot |
| `qty` | INT | NOT NULL, CHECK > 0 | |
| `subtotal` | NUMERIC(12,2) | NOT NULL | |

**Index**: (`order_id`).

## 7. `payments`
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `order_id` | UUID | FK → `orders.id` | |
| `provider` | ENUM `pay_provider` | NOT NULL | `stripe` \| `paypal` \| `crypto` \| `wallet` |
| `provider_txn_id` | VARCHAR(255) | | id bên cổng |
| `amount` | NUMERIC(12,2) | NOT NULL | |
| `currency` | VARCHAR(3) | NOT NULL | |
| `status` | ENUM `pay_status` | NOT NULL, default `pending` | `pending` \| `succeeded` \| `failed` \| `refunded` |
| `raw` | JSONB | | payload webhook (audit) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Index**: (`order_id`), (`provider`, `provider_txn_id`).

## 8. `subscriptions` *(để ngỏ — chỉ dùng nếu bán "gói truy cập"; store hiện bán script one-time)*
| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id` | |
| `plan_product_id` | VARCHAR(24) | NOT NULL | **ref Mongo** `products(type=plan)` |
| `status` | ENUM `sub_status` | NOT NULL | `active` \| `past_due` \| `cancelled` \| `expired` |
| `cycle` | ENUM `billing_cycle` | NOT NULL | `monthly` \| `yearly` |
| `current_period_start` | TIMESTAMPTZ | NOT NULL | |
| `current_period_end` | TIMESTAMPTZ | NOT NULL | |
| `quota` | JSONB | | chốt lúc mua: `{max_profiles, profiles_per_day, max_members, max_devices}` |
| `usage` | JSONB | | `{profiles_used_today, members_used, ...}` |
| `auto_renew` | BOOLEAN | default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Index**: (`user_id`), (`status`).

## 9. `entitlements`
Thứ user sở hữu sau khi mua (giao hàng số).

| column | type | constraint | mô tả |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id` | |
| `order_id` | UUID | FK → `orders.id` | nguồn gốc |
| `script_id` | VARCHAR(24) | NOT NULL | **ref Mongo** `scripts._id` |
| `kind` | ENUM `entitlement_kind` | NOT NULL | `script_license` \| `download` |
| `payload` | JSONB | | script → `{license_key}`; proxy → `{host,port,user,pass,expires_at}` |
| `expires_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Index**: (`user_id`), (`order_id`).

---

## Quan hệ (trong SQL)

```
users 1 ──1 carts 1 ──N cart_items
users 1 ──N orders 1 ──N order_items
orders 1 ──1 payments
users 1 ──N subscriptions
users 1 ──N entitlements ──N← orders
users 1 ──N user_addresses
```

## Enums cần tạo (Postgres)
`user_role`, `user_status`, `billing_cycle`, `order_status`, `pay_provider`, `pay_status`, `entitlement_kind`
(`script_license` \| `download`), và `sub_status` *(chỉ nếu giữ `subscriptions`)*.

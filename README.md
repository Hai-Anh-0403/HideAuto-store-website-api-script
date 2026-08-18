# storeAutoHide

Cửa hàng bán **mini app automation** (workflow `.hideflow`) cho app desktop **hideflow**.

| Thư mục | Nội dung |
|---|---|
| [`server/`](./server) | NestJS + Prisma + PostgreSQL — REST API `/api/v1` |
| [`web/`](./web) | Next.js (App Router) + TypeScript — cổng seller |
| [`docs/`](./docs) | Schema & luồng publish (nguồn sự thật) |

Monorepo dùng **pnpm workspace**; hai package `server` và `web` cài chung một lần từ thư mục gốc.

---

## Chạy — 1 lệnh

Chỉ cần **Docker**. Lệnh này dựng cả Postgres + server + web:

```bash
docker compose up -d --build
```

- Web: <http://localhost:3000>
- API + Swagger: <http://localhost:3001/docs> (dùng để thao tác **admin**: duyệt seller, duyệt version)

Server tự `prisma db push` + seed lúc khởi động, nên DB trống vẫn dùng được ngay:
6 tag mặc định và một admin **`admin@local.test` / `admin12345`**.

> ⚠️ Mật khẩu admin mặc định đó nằm trong repo, ai cũng biết. Máy cá nhân thì tiện, còn
> deploy ra chỗ truy cập được thì **bắt buộc** đặt `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`
> và đổi mật khẩu Postgres. Seed không bao giờ ghi đè mật khẩu của admin đã tồn tại.

Lần sau chỉ cần `docker compose up -d` (thêm `--build` khi code đổi) · `docker compose stop` để tắt ·
`docker compose logs -f server` xem log · `docker compose down -v` xoá sạch cả dữ liệu.
Chi tiết ở [compose.yaml](./compose.yaml).

---

## Chạy kiểu dev (hot reload)

Cần **Node 22+** và **pnpm**. Postgres vẫn chạy bằng Docker:

```bash
docker compose up -d postgres
```

```bash
pnpm install
cp server/.env.example server/.env   # sửa JWT_SECRET, DATABASE_URL nếu cần
pnpm db:push                         # tạo bảng từ prisma/schema.prisma
pnpm db:seed                         # tag mặc định (+ admin nếu đặt ADMIN_EMAIL/ADMIN_PASSWORD)
pnpm dev                             # chạy song song server (3001) + web (3000)
```

Chạy native thì `db:push`/`db:seed` phải gọi tay — chỉ bản Docker mới tự làm lúc khởi động.

Next rewrite `/api/*` → `http://localhost:3001`, không cần cấu hình CORS. Đổi origin bằng
`API_ORIGIN` (xem [web/.env.example](./web/.env.example)).

Chạy riêng: `pnpm dev:server` hoặc `pnpm dev:web`.

---

## Thử một vòng đầy đủ

1. **Web** → tab *Đăng ký* → tạo seller (trạng thái `PENDING`).
2. **Swagger** → `POST /api/v1/auth/admin/login` (`admin@local.test` / `admin12345`) → lấy token →
   `Authorize` → `GET /api/v1/admin/sellers` → `PATCH /api/v1/admin/sellers/{id}/approve`.
3. **Web** → đăng nhập seller → *Mini app của tôi* → **Tải mini app lên**
   (gói `.zip`/`.exe` của mini app, hoặc file `app.workflow` / graph `.json`).
   Store tự tách graph, **xoá credential**, và suy ra node/khả năng/biến từ graph.
4. **Web** → *Gửi duyệt*.
5. **Swagger** → `PATCH /api/v1/admin/scripts/versions/{vid}/approve`.
   Còn credential trong graph ⇒ trả **409**, seller phải xoá và tải lại.
6. **Web** → tab *Khóa* → tạo khóa (mở đúng mini app đó).

---

## Kiểm tra chất lượng

```bash
pnpm -r run build
```

```bash
cd server && npx tsc --noEmit && pnpm lint && pnpm test
```

```bash
cd web && npx tsc --noEmit && pnpm lint
```

---

## Tài liệu

- [server/prisma/schema.prisma](./server/prisma/schema.prisma) — schema PostgreSQL (nguồn sự thật)
- [docs/script-publish-packaging.md](./docs/script-publish-packaging.md) — luồng upload → scrub → duyệt → đóng gói
- [CLAUDE.md](./CLAUDE.md) — quy ước code

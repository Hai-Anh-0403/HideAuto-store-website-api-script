# storeAutoHide

Cửa hàng bán **mini app automation** (workflow `.hideflow`) cho app desktop **hideflow**.

| Thư mục | Nội dung |
|---|---|
| [`server/`](./server) | NestJS + Prisma + MySQL — REST API `/api/v1` |
| [`web/`](./web) | Next.js (App Router) + TypeScript — cổng seller |
| [`docs/`](./docs) | Schema & luồng publish (nguồn sự thật) |

Monorepo dùng **pnpm workspace**; hai package `server` và `web` cài chung một lần từ thư mục gốc.

---

## Chạy — 1 lệnh

Chỉ cần **Docker**. Lệnh này dựng cả MySQL + server + web:

```bash
docker compose up -d --build
```

- Web: <http://localhost:3000>
- Trang duyệt (admin): <http://localhost:3000/admin> — duyệt seller, duyệt version
- API + Swagger: <http://localhost:3001/docs>

Server tự `prisma db push` + seed lúc khởi động, nên DB trống vẫn dùng được ngay:
6 tag mặc định và một admin **`admin@local.test` / `admin12345`**.

> ⚠️ Mật khẩu admin mặc định đó nằm trong repo, ai cũng biết. Máy cá nhân thì tiện, còn
> deploy ra chỗ truy cập được thì **bắt buộc** đặt `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`
> và đổi mật khẩu MySQL. Seed không bao giờ ghi đè mật khẩu của admin đã tồn tại.

Lần sau chỉ cần `docker compose up -d` (thêm `--build` khi code đổi) · `docker compose stop` để tắt ·
`docker compose logs -f server` xem log · `docker compose down -v` xoá sạch cả dữ liệu.
Chi tiết ở [compose.yaml](./compose.yaml).

---

## Chạy kiểu dev (hot reload)

Cần **Node 22+** và **pnpm**. MySQL vẫn chạy bằng Docker:

```bash
docker compose up -d mysql
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

## Dữ liệu demo (tuỳ chọn)

`pnpm db:seed` chỉ tạo tag + **admin**, mà form đăng nhập của web là của **seller** — nên tài
khoản admin không vào được portal, và portal mới dựng thì trống trơn. Muốn có sẵn dữ liệu để
bấm thử:

```bash
pnpm db:seed:demo                      # khi chạy native (pnpm dev)
docker exec sah-server node dist/seed-demo.js   # khi chạy bằng docker compose
```

> Đang chạy bằng docker mà seed từ host thì graph đã scrub sẽ nằm ở `server/var/storage` trên
> máy bạn, còn API trong container đọc `/data/storage` — nút tải graph sẽ 404. Seed bên trong
> container thì cả DB lẫn file đều đúng chỗ.

Tạo một seller đã duyệt (`APPROVED`) kèm 3 mini app, 4 version, 4 khoá và 3 thành viên:

| | |
|---|---|
| Portal | <http://localhost:3000> |
| Email | `seller@local.test` |
| Mật khẩu | `seller12345` |

Đổi bằng `DEMO_EMAIL` / `DEMO_PASSWORD`. Chạy lại được nhiều lần (upsert theo email/slug/khoá),
và **luôn reset mật khẩu** seller demo để thông tin ở trên lúc nào cũng đúng.

Graph đi qua đúng pipeline thật (`extractPackage` → `scrubCredentials` → `deriveMetadata`), nên
các cột metadata giống hệt một lần publish thật. Riêng *Gmail Warmup Bot* cố tình nhúng API key
và mật khẩu SMTP: store xoá trắng khi lưu, và version đó **bị chặn duyệt** (409) — đúng luồng
thật ở bước 5 bên dưới.

Dọn sạch khi không cần nữa:

```bash
pnpm db:seed:demo:clear
```

Xoá seller demo cùng toàn bộ script / version / khoá / thành viên / thiết bị / bản build và các
file graph đã lưu. Tag và admin giữ nguyên (đó là của `db:seed`), và tài khoản bạn tự tạo tay
trong portal cũng không bị đụng — lệnh này chỉ nhắm đúng `DEMO_EMAIL`.

> ⚠️ Chỉ dùng khi dev. Toàn bộ là dữ liệu giả và mật khẩu nằm sẵn trong repo.

---

## Thử một vòng đầy đủ

1. **Web** → tab *Đăng ký* → tạo seller (trạng thái `PENDING`). Chưa duyệt thì không đăng app
   hay phát khoá được — API trả `seller_not_approved`.
2. **Trang duyệt** <http://localhost:3000/admin> → đăng nhập `admin@local.test` / `admin12345`
   → tab *Cửa hàng* → **Duyệt** (từ chối thì nhập lý do, seller sẽ đọc được).
3. **Web** → đăng nhập seller → *Mini app của tôi* → **Tải mini app lên**
   (gói `.zip`/`.exe` của mini app, hoặc file `app.workflow` / graph `.json`).
   Store tự tách graph, **xoá credential**, và suy ra node/khả năng/biến từ graph.
4. **Web** → *Gửi duyệt*.
5. **Trang duyệt** → tab *Chờ duyệt* → xem scan (số secret, node dùng shell) → **Duyệt và cho bán**.
   Còn credential trong graph ⇒ nút bị chặn, API trả **409**; seller phải xoá và tải lại.
6. **Web** → *Khoá kích hoạt* → **Tạo khoá**: chọn 1 mini app hoặc *cả shop*, đặt số lượng,
   giới hạn lượt và hạn dùng → copy khoá (hoặc tải CSV) gửi người mua.

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

- [server/prisma/schema.prisma](./server/prisma/schema.prisma) — schema MySQL (nguồn sự thật)
- [docs/script-publish-packaging.md](./docs/script-publish-packaging.md) — luồng upload → scrub → duyệt → đóng gói
- [CLAUDE.md](./CLAUDE.md) — quy ước code

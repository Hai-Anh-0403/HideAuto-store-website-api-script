# storeAutoHide

Cửa hàng bán **mini app automation** (workflow `.hideflow`) cho app desktop **hideflow**.

| Thư mục | Nội dung |
|---|---|
| [`api/`](./api) | FastAPI + MongoDB (Beanie) — REST API `/api/v1` |
| [`ui/`](./ui) | React + Vite — cổng seller |
| [`docs/`](./docs) | Schema & luồng publish (nguồn sự thật) |

---

## Chạy — 1 lệnh

Chỉ cần **Docker**. Lệnh này dựng cả Mongo + API + UI:

```bash
docker compose up -d --build
```

- UI: <http://localhost:5173>
- API + Swagger: <http://localhost:8000/docs> (dùng để thao tác **admin**: duyệt seller, duyệt version)

Lần sau chỉ cần `docker compose up -d` (thêm `--build` khi code đổi) · `docker compose stop` để tắt ·
`docker compose logs -f api` xem log · `docker compose down -v` xoá sạch cả dữ liệu.
Chi tiết ở [compose.yaml](./compose.yaml).

Trước lần chạy đầu: `cp api/.env.example api/.env`, rồi sửa `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`,
`INITIAL_ADMIN_PASSWORD` (admin được seed lúc khởi động nếu DB chưa có admin nào).

---

## Chạy kiểu dev (hot reload)

Cần thêm **Python 3.12+ với [uv]** và **Node 18+**. Mongo vẫn chạy bằng Docker:

```bash
docker compose up -d mongo
```

```bash
cd api && uv sync && uv run uvicorn app.main:app --reload
```

```bash
cd ui && npm install && npm run dev
```

Vite proxy `/api` → `http://127.0.0.1:8000`, không cần cấu hình CORS. Hai cách chạy dùng chung
MongoDB và chung thư mục artifact `api/var/`, nên đổi qua lại không mất dữ liệu.

---

## Thử một vòng đầy đủ

1. **UI** → tab *Đăng ký* → tạo seller. Với `SELLER_AUTO_APPROVE=true` (mặc định trong
   `.env.example` là `false`) tài khoản **dùng được ngay**, vào thẳng portal.
2. Nếu để `false`: **Swagger** → `POST /api/v1/admin/login` → lấy token → `Authorize` →
   `GET /api/v1/admin/sellers?status=pending` → `POST /api/v1/admin/sellers/{id}/approve`.
3. **UI** → đăng nhập seller → *Mini app của tôi* → **Tải mini app lên**
   (gói `.zip`/`.exe` của mini app, hoặc file `app.workflow` / graph `.json`).
   Store tự tách graph, **xóa credential**, và suy ra node/khả năng/biến từ graph.
4. **UI** → *Gửi duyệt*.
5. **Swagger** → `POST /api/v1/admin/scripts/{id}/versions/{vid}/approve`.
   Còn credential trong graph ⇒ trả **409**, seller phải xóa và tải lại.
6. **UI** → tab *Khóa* → tạo khóa (mở đúng mini app đó) → tab *Đóng gói .zip* → **Đóng gói lại**.
7. End-user (app hideflow, token flowdesk): `POST /api/v1/keys/redeem` → `GET /api/v1/app/scripts`
   → `GET /api/v1/app/scripts/{id}/download?format=exe`.

### Đóng gói lại `.zip`

Bước 6 cần **template mini-app rỗng**: một bản hideflow đã đóng gói, **nén zip**, chưa có
`resources/app.workflow`. Đặt file vào **`api/var/mini-app-template.zip`** — compose đã mount sẵn
đường dẫn đó. Chạy native thì trỏ bằng env:

```bash
MINI_APP_TEMPLATE_PATH=api/var/mini-app-template.zip
```

Chưa có file thì API trả **503** kèm thông báo, và chỉ tải được graph
(`?format=graph`). Server chỉ ghép file nên **không đổi được tên/icon `.exe`** —
việc đó cần build agent Windows (`rcedit`), xem [docs](./docs/script-publish-packaging.md#4-đóng-gói-lại-repackage).

---

## Kiểm tra chất lượng

```bash
cd api && uv run ruff check . && uv run mypy app && uv run pytest
```

```bash
cd ui && npm run typecheck && npm run build
```

---

## Tài liệu

- [docs/db/mongodb-catalog.md](./docs/db/mongodb-catalog.md) — schema MongoDB (catalog)
- [docs/script-publish-packaging.md](./docs/script-publish-packaging.md) — luồng upload → scrub → duyệt → đóng gói
- [CLAUDE.md](./CLAUDE.md) — quy ước code

[uv]: https://docs.astral.sh/uv/

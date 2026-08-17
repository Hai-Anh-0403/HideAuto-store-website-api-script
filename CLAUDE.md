# storeAutoHide — Project Configuration for Claude Code

Quick reference for Claude Code and development conventions.

**storeAutoHide** is a **web store backend** built with **Python + FastAPI** (REST API, JSON only)
that sells **automation scripts** (`.hideflow` workflows) for the hideflow desktop app.

---

## 🧭 Working Style

- **Be careful and thorough.** Treat every change as if it ships to production.
- **Always self-review after coding.** Re-read the diff end-to-end before declaring done — verify it solves the request, look for edge cases, broken imports, wrong types, unintended side effects.
- **Verify before claiming success.** Run `uv run mypy app` and `uv run ruff check .` (and `uv run pytest` when relevant); never report a task finished on unverified code. If something is skipped or fails, say so plainly.
- **Prefer reviewing existing similar code** before adding new patterns (routers, schemas, repositories, services).
- **Keep the layers clean.** Routers stay thin (validation + delegation); business logic in `services/`; DB access in `repositories/`. Don't put Beanie/Mongo queries directly in route handlers.
- **Pydantic is the API boundary.** Every request/response uses a Pydantic schema — never return raw Beanie documents or leak internal fields (secrets, embedded credentials) in responses.
- **Async all the way.** DB and I/O are async (`async def`, `await`, PyMongo async/Beanie). Never block the event loop; offload CPU-bound work to a threadpool.
- **Stay skeptical of external reviews.** Re-verify any finding from another agent/plugin against the actual code before acting.

---

## 📋 Project Summary

REST API backend for a **script marketplace**: sellers upload `.hideflow` automation workflows, the store validates/scrubs them and lists them for sale; buyers browse, review, and (later) purchase.

### Tech Stack
- **Language**: Python 3.12+
- **Framework**: FastAPI (ASGI)
- **Server**: Uvicorn (dev) / Uvicorn workers behind a process manager (prod)
- **Database (primary)**: **MongoDB** — catalog / marketplace content
- **Driver / ODM**: **PyMongo async** (`AsyncMongoClient`) + **Beanie** (Pydantic v2 document ODM)
- **Database (later)**: SQL (PostgreSQL) for **users + transactions** (auth, cart, orders, payments) — not built yet
- **Validation/Serialization**: Pydantic v2 (+ `pydantic-settings` for config)
- **Auth**: OAuth2 password flow + JWT (`python-jose`), password hashing (`bcrypt`)
- **Package/Env Manager**: **uv**
- **Testing**: pytest (+ `httpx.AsyncClient`, `pytest-asyncio`)
- **Lint/Format**: Ruff — **Type Checking**: mypy

### Data model
- **Schema docs are the source of truth**: [docs/db/mongodb-catalog.md](./docs/db/mongodb-catalog.md) (now) and [docs/db/sql-schema.md](./docs/db/sql-schema.md) (later).
- **MongoDB (now)**: `categories`, `tags`, `scripts`, `script_versions`, `reviews`, `uploads`, `mini_app_builds`. **No payment/checkout here.**
- **SQL (later)**: `users`, `carts`, `orders`, `entitlements` (payments/subscriptions only if needed).
- **Cross-DB boundary**: Mongo stores `user_id`/`seller_id`/`owner_id` as string refs to SQL `users.id`; SQL stores `script_id` as the Mongo ObjectId hex. No hard FK across DBs; snapshot name/price into orders.

---

## 🚀 Quick Start

```bash
# Install dependencies (creates .venv from pyproject.toml + uv.lock)
uv sync

# Run dev server (hot reload)
uv run uvicorn app.main:app --reload

# Type check
uv run mypy app

# Lint + format
uv run ruff check .
uv run ruff format .

# Tests
uv run pytest

# MongoDB migrations / indexes (Beanie)
uv run beanie migrate -uri "$MONGODB_URI" -db "$MONGODB_DB" -p migrations/
```

Requires a running MongoDB (local `mongod`, Docker, or Atlas). Set `MONGODB_URI` / `MONGODB_DB` in `.env`.

---

## 📁 Project Structure

```
app/
├── main.py               # FastAPI factory: lifespan → PyMongo async client + init_beanie(document_models=[...])
├── core/
│   ├── config.py         # Settings via pydantic-settings (MONGODB_URI, MONGODB_DB, JWT_SECRET, ...)
│   ├── database.py       # AsyncMongoClient, get_client(), init_beanie wiring
│   └── security.py       # JWT create/decode, password hash/verify
├── api/
│   ├── deps.py           # shared dependencies: get_current_user, pagination
│   └── v1/
│       ├── router.py     # aggregates all v1 routers
│       └── routes/       # scripts.py, categories.py, tags.py, reviews.py, uploads.py, mini_app_builds.py
├── models/               # Beanie Documents (ODM): script.py, script_version.py, category.py, tag.py, review.py, upload.py, mini_app_build.py
├── schemas/              # Pydantic request/response DTOs (Create/Update/Read)
├── repositories/         # DB access layer (Beanie queries, one module per collection)
├── services/             # business logic (script publish/validate, credential scrubbing, pricing)
└── utils/                # cross-cutting helpers (e.g. .hideflow parse/scrub, graph scan)

migrations/               # Beanie migration modules (data backfills / index changes)
tests/
├── conftest.py           # fixtures: app, async client, test Mongo (test DB or mongomock-motor)
└── ...                   # test_scripts.py, test_reviews.py, ...

pyproject.toml            # deps + tool config (ruff, mypy, pytest) — managed by uv
uv.lock                   # locked dependency versions (commit this)
.env.example              # documented env vars (never commit real .env)
```

---

## 🔧 Development Conventions

### Code Style

Python 3.12+ with full type hints (strict-ish mypy; avoid untyped functions).

```python
# ✅ Good — typed, async, thin router delegating to a service
@router.post("/scripts", response_model=ProductRead, status_code=201)
async def publish_script(
    payload: ScriptCreate,
    user: CurrentUser = Depends(get_current_user),
) -> ProductRead:
    return await script_service.publish(user=user, data=payload)

# ❌ Bad — no types, Beanie query in the handler, returns raw document
@router.post("/scripts")
async def publish_script(payload):
    p = Product(**payload)
    await p.insert()
    return p
```

**File & Naming**
- Modules/files: `snake_case.py` (e.g. `script_service.py`, `script.py`)
- Classes (Beanie documents, Pydantic schemas): `PascalCase` (`Product`, `ScriptCreate`)
- Functions/variables: `snake_case`; constants: `UPPER_SNAKE_CASE`
- One collection per model file.

**Imports**: absolute from the `app` package (`from app.services import script_service`).

### FastAPI Conventions

- **Routers per resource** under `app/api/v1/routes/`, aggregated in `app/api/v1/router.py`, mounted in `main.py` with prefix `/api/v1`.
- **Dependencies** (`Depends`) for auth and pagination — defined in `app/api/deps.py`.
- **Always set `response_model`** and an explicit `status_code` on write endpoints.
- **Raise `HTTPException`** (or mapped domain exceptions) for error paths — never return error dicts ad hoc.
- Keep OpenAPI docs meaningful (clear summary/tags per route).

### Pydantic (schemas)

- Separate schemas for input vs output: `XxxCreate`, `XxxUpdate`, `XxxRead`.
- `Read` schemas use `model_config = ConfigDict(from_attributes=True)` to serialize documents.
- Never expose sensitive fields (embedded credentials, internal flags) in `Read` schemas.
- Validate constraints in schemas (`Field(gt=0)`, `EmailStr`, enums) rather than in handlers.

### MongoDB (Beanie / PyMongo async)

- Models inherit `beanie.Document`; declare the collection name and indexes in the inner `Settings` class.
- Access DB only through `repositories/` functions; keep queries out of routes/services where possible.
- Use `Link`/manual refs deliberately; **cross-DB refs (user/seller) are plain strings**, not `Link`.
- Prefer explicit projections and pagination (`.find(...).skip().limit()`); avoid loading whole collections.
- **Schema is enforced in code, not the DB** — validate everything with Pydantic/Beanie before insert.

### Script publish/validate (domain-critical)

- On upload, **parse the `.hideflow` graph**, **scrub embedded credentials** (block publish if any remain), and **derive metadata by scanning the graph** (node_count, capabilities, required_variables) — never trust seller-supplied metadata. Flag `uses_shell` (runCommand). See [docs/db/mongodb-catalog.md](./docs/db/mongodb-catalog.md) → "Script — quy tắc publish & validate".

### Configuration

- All config via `app/core/config.py` (`pydantic-settings`), read from environment / `.env`.
- Never hardcode secrets, DB URIs, or JWT keys. Document every var in `.env.example`.

### Errors & Logging

- Use the standard `logging` module (configured centrally) — no `print()` in application code.
- Log errors with context; don't swallow exceptions silently.

---

## 🎯 Adding a New Resource / Endpoint

Example: add a "Bundle" (collection of scripts) resource.

1. **Model** — `app/models/bundle.py` (Beanie `Bundle(Document)` + `Settings` collection/indexes).
2. **Register** the document in `init_beanie(document_models=[...])` (in `app/core/database.py` / `main.py` lifespan).
3. **Schemas** — `app/schemas/bundle.py`: `BundleCreate`, `BundleUpdate`, `BundleRead`.
4. **Repository** — `app/repositories/bundle.py`: async Beanie queries.
5. **Service** (if logic) — `app/services/bundle_service.py`: validation, business rules.
6. **Router** — `app/api/v1/routes/bundles.py`, include it in `app/api/v1/router.py`.
7. **Indexes / migration** — declare indexes in `Settings`; add a Beanie migration in `migrations/` for backfills.
8. **Tests** — `tests/test_bundles.py`.
9. **Verify** — `uv run mypy app`, `uv run ruff check .`, `uv run pytest`.

---

## 📝 Commit & PR Workflow

Use **conventional commits**:

```bash
git commit -m "feat: add script publish endpoint"
git commit -m "fix: scrub embedded credentials before listing"
git commit -m "refactor: extract graph scan into service"
git commit -m "test: add review creation tests"
git commit -m "chore: bump beanie"
```

**Before committing:**

```bash
uv run ruff format .
uv run ruff check .
uv run mypy app
uv run pytest
```

Branch naming: `feat/script-publish`, `fix/credential-scrub`, `docs/db-schema`.

---

## 🔍 Key Files Reference

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI factory + lifespan (PyMongo async client, `init_beanie`) |
| `app/core/config.py` | Settings (env-driven, pydantic-settings) |
| `app/core/database.py` | PyMongo async client + Beanie init |
| `app/core/security.py` | JWT + password hashing |
| `app/api/deps.py` | Shared dependencies (`get_current_user`, pagination) |
| `app/api/v1/router.py` | Aggregates all v1 routers |
| `docs/db/mongodb-catalog.md` | MongoDB catalog schema (source of truth, now) |
| `docs/db/sql-schema.md` | SQL user/transaction schema (source of truth, later) |
| `pyproject.toml` | Deps + tool config (ruff, mypy, pytest) |

---

## ⚠️ Important Notes

- **No secrets in code**: DB URI, JWT secret, payment keys → env only (`.env`, never committed).
- **Never list a script with real secrets**: publish flow must scrub embedded credentials (block if `embedded_credentials_count > 0`).
- **Derive script metadata from the graph**, don't trust seller input; surface `uses_shell` prominently.
- **Pydantic at the boundary**: validate all input, shape all output; never leak document internals.
- **Async safety**: no blocking calls in async handlers; use a threadpool for CPU-bound work.
- **Cross-DB refs are strings**, not hard FKs; users/transactions live in SQL (later).
- **Commit `uv.lock`** so environments are reproducible.

---

## 📚 Documentation

- **[docs/db/mongodb-catalog.md](./docs/db/mongodb-catalog.md)** — MongoDB catalog schema (now)
- **[docs/db/sql-schema.md](./docs/db/sql-schema.md)** — SQL user/transaction schema (later)
- **[docs/script-publish-packaging.md](./docs/script-publish-packaging.md)** — upload → publish → repackage flow
- **[docs/mini-app-licensing.md](./docs/mini-app-licensing.md)** — key → signed licence → mini-app activation (+ the two identity systems)
- **[.claude/rules/python.md](./.claude/rules/python.md)** — Python/FastAPI code rules
- **[.claude/rules/store-guardrails.md](./.claude/rules/store-guardrails.md)** — Project guardrails
- FastAPI interactive docs at `/docs` (Swagger) and `/redoc` when the server is running.

---

**Last updated**: 2026-08-09
**Project**: storeAutoHide (Python + FastAPI + MongoDB script marketplace API)

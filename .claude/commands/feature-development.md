---
name: feature-development
description: Workflow for implementing a new resource/endpoint in storeAutoHide (FastAPI + MongoDB/Beanie)
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development

Standard feature/endpoint workflow for the FastAPI + MongoDB (Beanie) backend.
Data-model source of truth: [docs/db/mongodb-catalog.md](../../docs/db/mongodb-catalog.md).

## Typical Files

- `app/models/` — Beanie `Document` (ORM/ODM layer) + `Settings` (collection, indexes)
- `app/schemas/` — Pydantic DTOs (`XxxCreate`, `XxxUpdate`, `XxxRead`)
- `app/repositories/` — DB access (Beanie queries)
- `app/services/` — business logic (validation, script publish/scrub, pricing)
- `app/api/v1/routes/` — routers; aggregate in `app/api/v1/router.py`
- `app/api/deps.py` — shared dependencies (auth, pagination)

## Suggested Sequence

1. Define/adjust the **Beanie document** in `app/models/` (+ register in `init_beanie`).
2. Add **Pydantic schemas** (`Create`/`Update`/`Read`) in `app/schemas/`.
3. Implement **repository** functions in `app/repositories/`.
4. Put **business logic** in `app/services/` (keep routers thin).
5. Add the **router** in `app/api/v1/routes/` and include it in `router.py`.
6. Set `response_model` + `status_code`; never leak secrets/internal fields.
7. Add **tests** (`tests/test_*.py`) with `httpx.AsyncClient`.
8. Verify: `uv run mypy app`, `uv run ruff check .`, `uv run pytest`.

## Typical Commits

- `feat: add [resource] endpoint`
- `feat: add [resource] model + indexes`
- `test: add [resource] tests`

## Quick Checks

```bash
uv run mypy app
uv run ruff check .
uv run pytest
uv run uvicorn app.main:app --reload   # smoke test /docs
```

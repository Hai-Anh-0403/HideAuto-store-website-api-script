---
name: database-migration
description: MongoDB schema/index changes & data migrations for storeAutoHide (Beanie ODM)
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /database-migration

MongoDB is schemaless, so "migration" here means **index changes** + **data backfills**, driven by
Beanie `Document` models. Source of truth: [docs/db/mongodb-catalog.md](../../docs/db/mongodb-catalog.md).

## Key Files

- `app/models/*.py` — Beanie `Document` definitions (fields + `Settings.indexes`)
- `app/core/database.py` / `app/main.py` — `init_beanie(document_models=[...])`
- `migrations/` — Beanie migration modules (forward/backward)
- `.env` — `MONGODB_URI`, `MONGODB_DB`

## Workflow

1. **Edit the model** in `app/models/*.py` (add/rename fields, adjust `Settings.indexes`).
2. **Register** any new document in `init_beanie(document_models=[...])`.
3. **Backfill / index migration** — if existing documents need changing:
   - Add a module in `migrations/` (Beanie `iterative_migration` or `free_fall_migration`).
   - Run: `uv run beanie migrate -uri "$MONGODB_URI" -db "$MONGODB_DB" -p migrations/`
4. **Handle old documents defensively** — new fields optional or with defaults; no server-side schema.
5. **Verify** — `uv run mypy app`, then run app / tests to confirm indexes build and reads work.

## Important

- **Cross-DB refs are plain strings** (`user_id`, `seller_id`, `product_id`) — not Beanie `Link`.
- Declare indexes in each model's `Settings.indexes` (unique, compound, text). Beanie creates them on init.
- Watch for **destructive backfills** (dropping/overwriting fields) — write reversible migrations where possible.
- Keep model change + migration module in the same commit.

## Quick Checks

```bash
uv run mypy app
uv run pytest
# spot-check indexes in a Mongo shell / Compass after startup
```

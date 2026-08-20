---
name: database-migration
description: MySQL schema changes & data migrations for storeAutoHide (Prisma)
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /database-migration

Schema changes are driven by **`server/prisma/schema.prisma`** — the single source of truth.
Prisma generates both the SQL migration and the typed client from it.

## Key Files

- `server/prisma/schema.prisma` — models, enums, indexes, relations
- `server/prisma/migrations/` — generated SQL migrations (commit these)
- `server/prisma/seed.ts` — idempotent dev seed (tags + optional admin)
- `server/.env` — `DATABASE_URL`

## Workflow

1. **Edit `schema.prisma`** — add/rename fields, enums, `@@index`, relations.
2. **Apply it:**
   - Prototyping: `pnpm db:push` (no migration file, fastest loop)
   - Committed change: `pnpm db:migrate` → writes `prisma/migrations/<ts>_<name>/migration.sql`
3. **Regenerate the client** if you only used `db:push` on another machine:
   `pnpm --filter server exec prisma generate`
4. **Mirror the change in the frontend** — `web/src/types.ts` must match the new response shape
   (Prisma emits **camelCase** fields; enums are **UPPERCASE**).
5. **Verify** — `cd server && npx tsc --noEmit && pnpm test`, then boot and exercise the route.

## Important

- **Renaming a column loses data** unless the migration is edited to `ALTER ... RENAME`.
  Prisma's default is drop + add — review the generated SQL before applying it anywhere real.
- Adding a **required** column to a non-empty table needs a default or a backfill step.
- Cross-check `@@index` on every column used in a `where`/`orderBy` on a large table.
- Keep the schema edit + generated migration in the **same commit**.
- `db:push` is for local prototyping only — never as the production path.

## Quick Checks

```bash
pnpm db:migrate
cd server && npx tsc --noEmit && pnpm test
pnpm db:studio   # eyeball the data
```

---
name: feature-development
description: Workflow for implementing a new resource/endpoint in Store-HideAuto (NestJS + Prisma, Next.js)
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development

Standard feature/endpoint workflow for the NestJS + Prisma API and the Next.js portal.
Data-model source of truth: `server/prisma/schema.prisma`.

## Typical Files

- `server/prisma/schema.prisma` — the model, its enums and indexes
- `server/src/<resource>/dto/` — `class-validator` DTOs (`Create`/`Update`), **camelCase fields**
- `server/src/<resource>/<resource>.service.ts` — business logic + Prisma queries
- `server/src/<resource>/<resource>.controller.ts` — thin route layer, guards, Swagger
- `server/src/<resource>/<resource>.module.ts` — registered in `src/app.module.ts`
- `web/src/types.ts` — response shape mirroring the API
- `web/src/app/...` — the page consuming it

## Suggested Sequence

1. **Model** — add it to `schema.prisma`, then `pnpm db:migrate`.
2. **DTOs** — `Create`/`Update` with validation decorators. Fields are **camelCase**; multipart
   list fields are comma-separated strings, JSON list fields are real arrays.
3. **Service** — Prisma queries; always scope seller data with `where: { id, sellerId }` and
   paginate lists into a `PageDto`.
4. **Controller** — `@Controller('api/v1/<resource>')`, guards
   (`JwtAuthGuard` + `SellerAuthGuard`, or `AdminAuthGuard`), `@ApiOperation`, explicit `@HttpCode`.
5. **Module** — create it and register in `app.module.ts`.
6. **Frontend** — add the type to `web/src/types.ts`, then the call/page. New UI strings must exist
   in **both** `web/src/i18n/en.ts` and `vi.ts`.
7. **Verify** — see below.

## Watch Out

- `ValidationPipe` runs with **`forbidNonWhitelisted: true`**: any field the frontend sends that the
  DTO doesn't declare is a **400**. Keep payload and DTO in exact sync.
- Never select or return the `password` column.
- Touching `src/common/graph/` means updating `server/test/workflow-graph.test.ts`.

## Typical Commits

- `feat: add [resource] endpoint`
- `feat: add [resource] model + migration`
- `test: add [resource] tests`

## Quick Checks

```bash
cd server && npx tsc --noEmit && pnpm lint && pnpm test
cd web    && npx tsc --noEmit && pnpm lint
pnpm dev   # smoke test http://localhost:3001/docs
```

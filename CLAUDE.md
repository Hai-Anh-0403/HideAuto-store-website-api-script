# storeAutoHide — Project Configuration for Claude Code

Quick reference for Claude Code and development conventions.

**storeAutoHide** is a **web store** for **automation scripts** (`.hideflow` workflows) used by the
hideflow desktop app. It is a **pnpm monorepo**: a **NestJS + Prisma + PostgreSQL** API (`server/`)
and a **Next.js + TypeScript** seller portal (`web/`).

---

## 🧭 Working Style

- **Be careful and thorough.** Treat every change as if it ships to production.
- **Always self-review after coding.** Re-read the diff end-to-end before declaring done — verify it solves the request, look for edge cases, broken imports, wrong types, unintended side effects.
- **Verify before claiming success.** Run `npx tsc --noEmit` in the package you touched, plus `pnpm lint` / `pnpm test` when relevant; never report a task finished on unverified code. If something is skipped or fails, say so plainly.
- **Prefer reviewing existing similar code** before adding new patterns (controllers, DTOs, services, pages).
- **Keep the layers clean.** Controllers stay thin (validation + delegation); business logic in `*.service.ts`; DB access through `PrismaService`. Don't put Prisma queries directly in controllers.
- **DTOs are the API boundary.** Every request body/query uses a `class-validator` DTO — never accept raw input, never return fields that leak secrets.
- **Async all the way.** Prisma and I/O are async. Never block the event loop; offload CPU-bound work.
- **Stay skeptical of external reviews.** Re-verify any finding from another agent/plugin against the actual code before acting.

---

## 📋 Project Summary

REST API + seller portal for a **script marketplace**: sellers upload `.hideflow` automation
workflows, the store validates/scrubs them and lists them for sale; buyers browse and redeem keys.

### Tech Stack
- **Language**: TypeScript (strict) on Node 22+
- **API**: NestJS 11 (Express platform), Swagger at `/docs`
- **DB**: PostgreSQL via **Prisma 6** (`server/prisma/schema.prisma` is the source of truth)
- **Frontend**: Next.js 15 App Router, React 19, plain CSS (`web/src/styles/`)
- **Auth**: JWT (`@nestjs/jwt` + passport-jwt), password hashing with `bcrypt`
- **Package manager**: **pnpm** (workspace at the repo root)
- **Lint**: ESLint 9 flat config — **Typecheck**: `tsc --noEmit`

### Data model
- **Source of truth**: [server/prisma/schema.prisma](./server/prisma/schema.prisma).
- Tables: `admins`, `sellers`, `seller_sessions`, `tags`, `scripts`, `script_versions`,
  `seller_keys`, `seller_members`, `mini_app_builds`.
- Prisma enums are **UPPERCASE** (`PENDING`, `PUBLISHED`, `ACTIVE`, …); the API returns Prisma's
  **camelCase** field names. The frontend types in `web/src/types.ts` must mirror both exactly.

---

## 🚀 Quick Start

```bash
pnpm install                  # install both packages from the repo root

docker compose up -d postgres # or point DATABASE_URL at your own Postgres
cp server/.env.example server/.env

pnpm db:push                  # apply schema.prisma to the database
pnpm db:seed                  # baseline tags (+ admin if ADMIN_EMAIL/ADMIN_PASSWORD set)
pnpm dev                      # server on :3001, web on :3000

pnpm -r run build             # build both packages
```

Per-package checks:

```bash
cd server && npx tsc --noEmit && pnpm lint && pnpm test
cd web    && npx tsc --noEmit && pnpm lint
```

After editing `schema.prisma`, run `pnpm --filter server exec prisma generate` (or `pnpm db:push`,
which generates too) so the Prisma client types update.

---

## 📁 Project Structure

```
server/
├── prisma/
│   ├── schema.prisma      # DB schema — source of truth
│   └── seed.ts            # idempotent dev seed (tags + optional admin)
├── src/
│   ├── main.ts            # bootstrap: global ValidationPipe, Swagger, CORS
│   ├── app.module.ts      # registers every feature module
│   ├── prisma/            # PrismaService (global)
│   ├── storage/           # content-addressed artifact storage (global)
│   ├── licensing/         # ⚠ Ed25519 licence signing (global)
│   ├── common/
│   │   ├── dto/           # PaginationDto, PageDto
│   │   ├── errors.ts      # AppException + coded subclasses
│   │   ├── http-exception.filter.ts   # one envelope: { detail, code }
│   │   └── graph/         # ⚠ domain-critical: .hideflow parse / scrub / derive
│   ├── auth/              # seller/admin login, JWT strategy, guards
│   ├── app-client/        # end users: flowdesk auth, redeem, entitlement, licence
│   ├── builds/            # mini-app repackaging (template inject) + packaging service
│   ├── sellers/ scripts/ tags/ keys/ members/ store/ admin/
│   └── …                  # each: *.module.ts, *.controller.ts, *.service.ts, dto/
└── test/                  # workflow-graph + license suites (run via `pnpm test`)

web/
├── next.config.ts         # rewrites /api/* → API_ORIGIN
└── src/
    ├── app/               # App Router pages (login, portal/*)
    ├── components/        # Pill, Pager, TagPicker, Toast, Brand
    ├── lib/               # api client, auth context, useFetch, pills, errors
    ├── i18n/              # en.ts / vi.ts
    └── types.ts           # DTOs mirroring the API responses
```

---

## 🔧 Development Conventions

### NestJS

- **One module per resource** under `src/<resource>/`, registered in `app.module.ts`.
- Controllers carry the full path: `@Controller('api/v1/scripts')`. There is no global prefix.
- Guard seller routes with `@UseGuards(JwtAuthGuard, SellerAuthGuard)`, admin routes with `AdminAuthGuard`.
- **Always set `@ApiOperation`** and an explicit `@HttpCode` on write endpoints.
- Errors via Nest's built-in exceptions (`NotFoundException`, `ConflictException`, …) — never ad-hoc error objects.
- Config only through `ConfigService` (env-driven); no hardcoded secrets or URLs.

### DTOs & validation

- `main.ts` runs `ValidationPipe` with `whitelist` + **`forbidNonWhitelisted: true`**: any field not
  declared on the DTO makes the request **400**. Frontend payloads and DTOs must match exactly.
- **Request DTOs use camelCase** (`shortDescription`, `tagIds`) to match the camelCase responses.
  Multipart bodies arrive as strings, so list fields there are comma-separated (`tagIds: string`);
  JSON bodies use real arrays (`tagIds: string[]`).
- `tsconfig` sets `strictPropertyInitialization: false` so DTO classes need no initializers.

### Prisma

- Edit `schema.prisma` → `pnpm db:push` (dev) or `pnpm db:migrate` (versioned migration).
- Query only inside services, through the injected `PrismaService`.
- Use `select`/`include` deliberately and always paginate lists (`skip`/`take` + `PageDto`).
- Never return the `password` column; select explicit fields on user-facing reads.

### Next.js (web)

- Pages are **client components** (`'use client'`) that fetch through `src/lib/api.ts`.
- The browser always calls same-origin `/api/*`; `next.config.ts` proxies to the API.
- Use `useFetch(loader, key)` for reads — `loading` is derived from the settled key, so never call
  `setState` synchronously inside an effect (the React 19 lint rules enforce this).
- Status → badge mapping lives in `src/lib/pills.ts`, keyed by the **UPPERCASE** enum values.
- Every user-facing string goes through `t(...)` and **must exist in both `en.ts` and `vi.ts`** —
  a missing key renders raw.

### Script publish/validate (domain-critical)

`server/src/common/graph/` is the heart of the store and mirrors the desktop app's own rules:

- `package-extract.ts` — pull the graph out of a `.zip`/`.exe`/`.json` upload. Archives are treated
  as hostile: entry names validated (zip-slip), entry count and size capped. Encrypted `.hideflow`
  exports are rejected; an unreadable `.exe` is accepted as an *opaque* build with `graphExtracted: false`.
- `workflow-graph.ts` — `scrubCredentials()` blanks every embedded secret (node config **and**
  `variables[]`) and reports **paths only, never values**; `deriveMetadata()` reads node count,
  groups, capabilities and required variables **out of the graph**.

Rules that must hold:

- **Only the scrubbed graph is persisted** — the original upload bytes are never stored.
- **Metadata is derived, never trusted** from seller input.
- **A version with `embedded_credentials_count > 0` can never be approved** (409 in `admin.service.ts`).
- `uses_shell` (the `runCommand` node) is surfaced prominently.

Changing this logic **requires** updating `server/test/workflow-graph.test.ts` and running `pnpm test`.

---

## 🎯 Adding a New Resource / Endpoint

Example: add a "Bundle" resource.

1. **Schema** — add the model to `prisma/schema.prisma`, then `pnpm db:push`.
2. **DTOs** — `server/src/bundles/dto/`: `create-bundle.dto.ts`, `update-bundle.dto.ts` (camelCase fields).
3. **Service** — `bundles.service.ts`: Prisma queries + business rules.
4. **Controller** — `bundles.controller.ts` with `@Controller('api/v1/bundles')`, guards, `@ApiOperation`.
5. **Module** — `bundles.module.ts`, registered in `app.module.ts`.
6. **Frontend** — add the response shape to `web/src/types.ts`, then the page/call.
7. **Verify** — `npx tsc --noEmit` in both packages, `pnpm lint`, `pnpm test`.

---

## 📝 Commit & PR Workflow

Use **conventional commits**:

```bash
git commit -m "feat: add script publish endpoint"
git commit -m "fix: scrub embedded credentials before listing"
git commit -m "refactor: extract graph scan into a helper"
git commit -m "test: cover credential scrubbing"
git commit -m "chore: bump prisma"
```

**Before committing:**

```bash
pnpm -r run build
cd server && npx tsc --noEmit && pnpm lint && pnpm test
cd web    && npx tsc --noEmit && pnpm lint
```

Branch naming: `feat/script-publish`, `fix/credential-scrub`, `docs/db-schema`.

---

## 🔍 Key Files Reference

| File | Purpose |
|------|---------|
| `server/prisma/schema.prisma` | DB schema (source of truth) |
| `server/src/main.ts` | Bootstrap: ValidationPipe, Swagger, CORS |
| `server/src/app.module.ts` | Module registry |
| `server/src/common/graph/workflow-graph.ts` | Credential scrubbing + metadata derivation |
| `server/src/common/graph/package-extract.ts` | Upload → graph extraction |
| `server/src/common/errors.ts` | Coded domain errors (`errors.<code>` in the portal) |
| `server/src/storage/storage.service.ts` | Content-addressed artifact storage |
| `server/src/licensing/license.service.ts` | Ed25519 licence signing (canonical bytes) |
| `server/src/app-client/activation.service.ts` | Key redeem, entitlement, activation |
| `server/src/builds/packaging.service.ts` | Repackage a version into a mini-app zip |
| `server/src/auth/` | JWT auth, guards, sessions |
| `web/src/types.ts` | Frontend DTOs mirroring API responses |
| `web/src/lib/api.ts` | Fetch wrapper + token handling |
| `web/src/lib/pills.ts` | Status → badge mapping (UPPERCASE keys) |

---

## ⚠️ Important Notes

- **No secrets in code**: `DATABASE_URL`, `JWT_SECRET` → env only. Document every var in `.env.example`.
- **Never list a script with real secrets**: uploads are scrubbed, and approval is blocked while
  `embedded_credentials_count > 0`.
- **Derive script metadata from the graph**, don't trust seller input; surface `uses_shell`.
- **`forbidNonWhitelisted` is on**: an undeclared field in a request body is a 400, not a silent ignore.
- **Enums are UPPERCASE, fields are camelCase** — keep `web/src/types.ts` in sync with Prisma.
- **Errors are `{ detail, code }`**: throw the coded classes in `common/errors.ts`. Every new code
  needs an `errors.<code>` entry in **both** `web/src/i18n/en.ts` and `vi.ts`, or the portal shows
  the raw English detail.
- **Two identity systems, never mixed**: sellers/admins use the store JWT (`JwtAuthGuard`), end
  users use a flowdesk token (`AppAuthGuard`). A store JWT must never unlock `/api/v1/app/*`.
- **Licence bytes are canonical**: `LicenseService.encodePayload` sorts keys and strips whitespace.
  Changing that invalidates every already-installed mini app — treat it as a wire format.
- **Commit `pnpm-lock.yaml`** so environments are reproducible.

---

## 🧭 Legacy

The pre-rewrite stack — `api/` (Python + FastAPI + MongoDB) and `ui/` (React + Vite) — has been
**removed**. It is still in git history if you need it:

```bash
git log --oneline -- api ui      # last state: "chore: checkpoint legacy api/ui before removal"
git show <commit>:api/app/services/script_service.py
```

Everything from the old stack is now ported. The one piece still missing is the **Windows
build-agent** (renaming/re-iconing the `.exe` with `rcedit`) — the server does template-inject
packaging instead, which cannot change the executable's identity. See
[docs/script-publish-packaging.md](./docs/script-publish-packaging.md) §4.2.

The buyer-facing key prompt lives in the **desktop app**, not here — see
[docs/mini-app-licensing.md](./docs/mini-app-licensing.md) §6.

---

**Last updated**: 2026-08-18
**Project**: storeAutoHide (NestJS + Prisma + PostgreSQL · Next.js + TypeScript)

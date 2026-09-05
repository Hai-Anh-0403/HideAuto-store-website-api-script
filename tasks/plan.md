# Implementation Plan: MongoDB-backed public sellers for home section 07

## Overview

Replace the mock sellers in home section `07 / Community` with an anonymous API backed entirely by MongoDB. Add a MongoDB `marketplace_sellers` read model for seller profile and marketplace status, then aggregate it with MongoDB `scripts` to return approved sellers and their published-script statistics.

This migration deliberately keeps MySQL as the authentication, session, key, member, and portal-account store. MongoDB becomes the source read by the public storefront. A later, separately approved migration may move authentication credentials and sessions into MongoDB; it is not safe to combine that work with the section 07 feature.

## Confirmed current state

- Home section 07 reads mock data from `web/src/features/developers/model.ts`.
- MongoDB already stores public catalog scripts in `scripts`; each script has a string `sellerId`, plus status and rating/download/view metrics.
- MongoDB does **not** currently have a seller schema or collection.
- Swagger at `http://localhost:3001/docs` confirms `/api/v1/sellers/me/*` and `/api/v1/admin/sellers/*` are MySQL-backed, authenticated portal/admin APIs. They are not appropriate for anonymous storefront reads.
- The existing public `StoreController` owns `/api/v1/store/*` and establishes the `skip`/`limit` page envelope convention.

## Architecture decisions

- Create a Mongoose `MarketplaceSeller` schema and store it in the `marketplace_sellers` collection.
- Preserve the existing MySQL CUID as MongoDB field `sellerId` (unique, indexed string). `Script.sellerId` already stores that same string, so no script rewrite or JWT-ID change is required.
- Store only public marketplace fields in MongoDB: `sellerId`, `slug`, `displayName`, optional avatar/profile copy, `status`, `createdAt`, and `updatedAt`. Never copy passwords, email, contact, sessions, keys, members, devices, or status reasons into this collection.
- Treat `marketplace_sellers` as a MongoDB **read model** for public storefront data. MySQL remains the authoritative seller account and moderation system during this slice.
- Registration and seller-status transitions must update the Mongo read model. Use an idempotent upsert keyed by `sellerId`; a reconciliation/backfill command repairs missed writes.
- Implement the public query as one MongoDB aggregation: `marketplace_sellers` filtered to `APPROVED` → `$lookup` published scripts by `sellerId` → calculate seller statistics → sort → paginate. The endpoint must not query MySQL.
- Add `GET /api/v1/store/sellers` to `StoreController`, not the authenticated `/api/v1/sellers` controller. It must appear in Swagger's **Store** group with no bearer lock.

## Public API contract

`GET /api/v1/store/sellers?skip=0&limit=3&sort=popular`

- Authentication: none.
- Eligibility: seller read-model status is `APPROVED` and the seller owns one or more `PUBLISHED` scripts.
- Pagination: existing `{ items, total, skip, limit }` envelope. `skip >= 0`; `1 <= limit <= 100`; default `limit = 20`.
- Initial sort: `popular` (default): total downloads descending, total views descending, `sellerId` ascending.
- Response shape:

```json
{
  "id": "seller-cuid",
  "slug": "automation-store",
  "displayName": "Automation Store",
  "avatarUrl": null,
  "headline": null,
  "joinedAt": "2026-01-18T09:30:00.000Z",
  "statistics": {
    "publishedScripts": 3,
    "downloads": 124,
    "views": 2160,
    "ratingAvg": 4.8,
    "ratingCount": 42
  }
}
```

- `ratingAvg` is rating-count weighted across published scripts. When every script has `ratingCount = 0`, return `0`.
- Never expose MySQL account data or private seller fields.

## Dependency graph

```text
Mongo MarketplaceSeller schema + indexes
        |
Backfill/reconciliation and MySQL lifecycle projection
        |
Public seller DTO + Mongo aggregation + service tests
        |
StoreController + Swagger contract
        |
Web types + section 07 data fetch and UI states
```

## Task list

### Phase 1: Mongo seller read model

## Task 1: Define the marketplace seller schema

**Description:** Add the `MarketplaceSeller` Mongoose schema with a string `sellerId`, safe public profile fields, status, timestamps, and indexes.

**Acceptance criteria:**

- [ ] `sellerId` is a unique indexed string compatible with `Script.sellerId`.
- [ ] `slug` is unique and `displayName` is required.
- [ ] Schema contains no password, email, contact, session, key, membership, device, or moderation-reason field.

**Verification:**

- [ ] Schema test verifies required fields, defaults, and unique index definitions.
- [ ] `pnpm --filter server lint` passes.

**Dependencies:** None.

**Files likely touched:**

- `server/src/sellers/schemas/marketplace-seller.schema.ts`
- `server/src/sellers/marketplace-sellers.module.ts`
- `server/test/marketplace-seller.schema.test.ts`

**Estimated scope:** S (3 files).

## Task 2: Project seller lifecycle events into MongoDB

**Description:** Create an idempotent projector/upsert service and call it after MySQL seller registration and admin approval/rejection/suspension decisions. Add a backfill/reconciliation command for existing sellers.

**Acceptance criteria:**

- [ ] Registration creates a `PENDING` Mongo read-model document with the same `sellerId`.
- [ ] Admin approval, rejection, and suspension update Mongo status and public display fields.
- [ ] Retrying an event does not create duplicate seller documents.
- [ ] Reconciliation can create/update all existing seller read-model documents without deleting unrelated Mongo data.

**Verification:**

- [ ] Focused tests cover create, status transition, retry, and reconciliation fixtures.
- [ ] A test proves a failed Mongo projection is observable/logged and can be repaired by reconciliation.
- [ ] `pnpm --filter server build` passes.

**Dependencies:** Task 1.

**Files likely touched:**

- `server/src/sellers/marketplace-seller-projector.service.ts`
- `server/src/auth/auth.service.ts`
- `server/src/admin/admin.service.ts`
- `server/src/seed-mongo-marketplace-sellers.ts`
- `server/test/marketplace-seller-projector.test.ts`

**Estimated scope:** M (5 files).

### Checkpoint: Mongo seller data is ready

- [ ] Existing seller IDs map one-to-one to `marketplace_sellers`.
- [ ] Status changes reach MongoDB and a reconciliation run reports no drift.
- [ ] No private seller data is present in a sample MongoDB document.

### Phase 2: Public seller API

## Task 3: Define and test the public seller list contract

**Description:** Add validated public query DTOs and Swagger response DTOs for `GET /api/v1/store/sellers`.

**Acceptance criteria:**

- [ ] Supports `skip`, `limit`, and `popular` with project-standard validation.
- [ ] Response DTO documents only safe fields and the statistics object.
- [ ] Swagger shows the endpoint under **Store** with no bearer security requirement.

**Verification:**

- [ ] DTO tests cover defaults and invalid pagination/sort values.
- [ ] Swagger document test asserts the path exists without `security`.

**Dependencies:** Task 1.

**Files likely touched:**

- `server/src/store/dto/browse-public-sellers.dto.ts`
- `server/src/store/dto/store-seller.dto.ts`
- `server/test/store-public-seller-dto.test.ts`

**Estimated scope:** S (3 files).

## Task 4: Implement Mongo-only seller aggregation and endpoint

**Description:** Query `marketplace_sellers` and `scripts` with a single aggregation, calculate published-script metrics, and expose the paginated result through `StoreController`.

**Acceptance criteria:**

- [ ] Only `APPROVED` sellers with at least one `PUBLISHED` script are returned.
- [ ] Query reads no MySQL/Prisma seller data.
- [ ] Aggregation returns weighted rating, published-script count, downloads, views, deterministic ordering, and correct total/skip/limit.
- [ ] Response excludes all private fields even if they are added to the Mongo document in the future.

**Verification:**

- [ ] Focused service test inspects the aggregation pipeline and output fixtures for eligibility, metrics, sort, and pagination.
- [ ] Anonymous HTTP test returns `200` and the Swagger response shape.
- [ ] `pnpm --filter server test:store-sellers`, `pnpm --filter server lint`, and `pnpm --filter server build` pass.

**Dependencies:** Tasks 2–3.

**Files likely touched:**

- `server/src/store/store.module.ts`
- `server/src/store/store.service.ts`
- `server/src/store/store.controller.ts`
- `server/test/store-sellers.service.test.ts`
- `server/package.json`

**Estimated scope:** M (5 files).

### Checkpoint: Public seller API ready

- [ ] `GET /api/v1/store/sellers?limit=3&sort=popular` returns only MongoDB-derived data.
- [ ] Swagger shows it under **Store** without a lock icon.
- [ ] Changing a seller to `SUSPENDED` removes them after projection/reconciliation.

### Phase 3: Connect home section 07

## Task 5: Replace mock sellers in section 07

**Description:** Add frontend public seller types, fetch the new public endpoint, and render safe seller summary cards with loading, error, and empty states.

**Acceptance criteria:**

- [ ] Section 07 requests `/store/sellers?skip=0&limit=3&sort=popular`.
- [ ] No component imports or renders `developers.slice(0, 3)` for the home section.
- [ ] The card handles absent avatar/headline safely and does not render seller email, phone, or a contact action.
- [ ] Seller links use the returned `slug`; detailed profile API work remains out of scope.

**Verification:**

- [ ] Component tests cover loading, populated, no-results, and API-error states.
- [ ] `pnpm --filter web lint` and `pnpm --filter web build` pass.
- [ ] Manual check at 320px, 768px, and 1440px confirms no layout shift or private data leakage.

**Dependencies:** Checkpoint: Public seller API ready.

**Files likely touched:**

- `web/src/types.ts`
- `web/src/app/(store)/page.tsx`
- `web/src/features/developers/seller-summary-card.tsx`
- `web/src/features/developers/*test.tsx`

**Estimated scope:** M (4 files).

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| MySQL lifecycle write succeeds but Mongo projection fails | High | Idempotent projection, error logging, and a repeatable reconciliation/backfill command. |
| Existing scripts reference a seller ID not present in Mongo | High | Backfill all sellers before enabling the endpoint; exclude orphaned script groups and report them. |
| Public profile collection accidentally grows private fields | High | Explicit aggregation `$project` allow-list plus schema review and API contract tests. |
| Mongo and MySQL status are briefly inconsistent | Medium | Treat Mongo status as the public-read gate; project changes immediately and reconcile drift. |
| Authentication migration expands scope into password/session security | High | Keep MySQL authentication out of this plan; create a separate, approved migration if needed. |

## Open questions

1. Are `slug`, `avatar`, and `headline` sufficient for the first public seller profile, or should seller bios and specialties be included now?
2. Is the MongoDB public seller profile a read model as proposed, or should MongoDB also replace MySQL for passwords, sessions, keys, and admin moderation? The latter requires a separate auth migration plan.
3. Should the initial endpoint serve only the top three home sellers or also back the complete `/sellers` directory?
4. Is `downloads` the correct popularity metric, or should ranking use a different business rule?

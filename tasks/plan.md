# Implementation Plan: Public sellers API for home section 07

## Overview

Replace the mock `developers` data used by home section `07 / Community` with a public, anonymous API that returns approved sellers who currently have published scripts. The response must contain only marketplace-safe profile and aggregate statistics; seller credentials, email, contact details, sessions, and membership data must never be exposed.

## Existing context

- The home page currently renders `developers.slice(0, 3)` from `web/src/features/developers/model.ts`.
- Public catalog data is MongoDB-backed (`scripts` and `script_versions`), while seller identity is stored in MySQL (`sellers`). `StoreService.browsePublic()` already bridges these stores through `sellerId`.
- A seller currently has no public profile slug, avatar, headline, or seller-level review model. The API must therefore not invent or promise those fields.

## Swagger audit — `http://localhost:3001/docs` (verified 2026-09-04)

- The existing **Sellers** tag is a private seller-portal surface only: `GET/PATCH /api/v1/sellers/me`, session management, password change, and seller overview stats all require a bearer token. It must not be reused by the anonymous storefront.
- `GET /api/v1/admin/sellers` is also bearer-protected and exposes moderation data; it must not be used by section 07.
- The anonymous store contract already lives under the **Store** tag: `GET /api/v1/store/scripts` and `GET /api/v1/store/tags`. Its pagination convention is `skip` (minimum `0`) and `limit` (minimum `1`, maximum `100`, default `20`).
- No `GET /api/v1/store/sellers` endpoint exists in the live OpenAPI document. This confirms a public seller-list endpoint is the missing API slice, rather than a frontend integration task against an existing endpoint.

## API contract

`GET /api/v1/store/sellers?skip=0&limit=3&sort=popular`

- Authentication: none.
- Eligible sellers: MySQL seller status is `APPROVED` and they own at least one MongoDB script with status `PUBLISHED`.
- Response: existing page envelope `{ items, total, skip, limit }`.
- Stable item shape:

```json
{
  "id": "seller-cuid",
  "name": "Automation Store",
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

- Supported initial sort: `popular` (default): downloads descending, then views descending, then seller ID ascending for deterministic results.
- Invalid pagination or sort uses the existing validation/error filter semantics.
- Do not expose: `email`, `contact`, `password`, seller status/reason, membership/key/session/device data, or unapproved/no-listing sellers.

## Architecture decisions

- Add the endpoint to the existing public `StoreController`; do not repurpose the authenticated `/api/v1/sellers` portal controller.
- Aggregate published-script statistics in MongoDB first, then hydrate the small page of seller IDs from MySQL in one `findMany` query. This follows the existing public-catalog boundary and avoids an N+1 query.
- Treat a seller as marketplace-visible only if both sources agree: Mongo exposes published work and MySQL says `APPROVED`.
- Reuse `PageDto` and the `skip`/`limit` naming already used by `/api/v1/store/scripts`; do not introduce a second pagination envelope.
- Add `@ApiOperation` and `@ApiOkResponse` so `GET /api/v1/store/sellers` appears under Swagger's **Store** tag without a bearer-security requirement.
- Keep this slice to list data for section 07. Seller profile/detail APIs, images, bios, reviews, and public contact actions require a separate product and schema decision.

## Dependency graph

```text
Public seller contract + query DTO
        |
Mongo aggregation of published script statistics
        |
MySQL approved-seller hydration and deterministic page response
        |
Controller + Swagger contract + focused service tests
        |
Web types + home section 07 data fetch + loading/empty/error state
```

## Task list

### Phase 1: Contract and backend vertical slice

## Task 1: Define the public seller-list contract

**Description:** Add a DTO for `skip`, `limit`, and the initial `popular` sort. Add explicit public response DTO/types for the safe seller summary and its statistics.

**Acceptance criteria:**

- [ ] `GET /api/v1/store/sellers` is documented as anonymous and paginated.
- [ ] Swagger lists the endpoint under **Store**, with no lock icon/bearer requirement; the existing **Sellers** and **Admin** routes remain unchanged.
- [ ] Query validation caps `limit` using the project pagination convention and rejects unsupported sort values.
- [ ] The response contract contains no internal or contact fields.

**Verification:**

- [ ] Focused DTO test covers defaults, valid query values, and invalid sort/pagination.
- [ ] `pnpm --filter server lint` passes.

**Dependencies:** None.

**Files likely touched:**

- `server/src/store/dto/browse-public-sellers.dto.ts`
- `server/src/store/dto/store-seller.dto.ts`
- `server/test/store-public-seller-dto.test.ts`

**Estimated scope:** S (3 files).

## Task 2: Implement the safe public sellers query

**Description:** Add a `StoreService` method that aggregates `PUBLISHED` MongoDB scripts by `sellerId`, derives seller statistics, sorts/pages the results, then hydrates only MySQL sellers whose status is `APPROVED`.

**Acceptance criteria:**

- [ ] Each returned seller owns at least one published script and is `APPROVED`.
- [ ] Statistics are calculated from published scripts only; `ratingAvg` is a rating-count-weighted average, with `0` when no ratings exist.
- [ ] The method makes one aggregate query and one batched MySQL lookup; it does not query MySQL once per seller.
- [ ] Pagination metadata matches the returned contract and sort order is deterministic.

**Verification:**

- [ ] Focused service test proves status filtering, metric aggregation, deterministic sorting, page metadata, and that sensitive fields are absent.
- [ ] `pnpm --filter server test:store-sellers` passes.

**Dependencies:** Task 1.

**Files likely touched:**

- `server/src/store/store.service.ts`
- `server/test/store-sellers.service.test.ts`
- `server/package.json`

**Estimated scope:** S (3 files).

## Task 3: Expose the controller endpoint and document it

**Description:** Add `GET /api/v1/store/sellers` to `StoreController`, delegating to the new service method and documenting the response in Swagger.

**Acceptance criteria:**

- [ ] Endpoint is public and does not carry seller/admin guards.
- [ ] Controller passes validated DTO input unchanged to the service.
- [ ] Swagger describes the page response and the eligibility rule.

**Verification:**

- [ ] Focused controller test or e2e request returns `200` for anonymous access and the documented shape.
- [ ] `pnpm --filter server build` passes.

**Dependencies:** Tasks 1–2.

**Files likely touched:**

- `server/src/store/store.controller.ts`
- `server/test/store-sellers.controller.test.ts` (or the existing store endpoint test file)

**Estimated scope:** S (2 files).

### Checkpoint: Public API ready

- [ ] DTO, service, and controller tests pass.
- [ ] `pnpm --filter server lint` and `pnpm --filter server build` pass.
- [ ] Manual anonymous request returns only approved sellers with published scripts.
- [ ] Contract reviewed before any frontend migration.

### Phase 2: Connect section 07

## Task 4: Replace home mock data with the public contract

**Description:** Add frontend `PublicSellerSummary` types and fetch the new endpoint in section 07. Render three returned sellers and preserve the existing loading, empty, and error behavior used by other home rails.

**Acceptance criteria:**

- [ ] Section 07 requests `/store/sellers?skip=0&limit=3&sort=popular`.
- [ ] It renders API statistics, not `developers.slice(0, 3)`.
- [ ] Loading state does not cause layout shift; an empty/error response does not leave a blank section.
- [ ] The UI does not display public contact buttons or profile links until a public seller-detail contract exists.

**Verification:**

- [ ] Component test covers loading, populated, empty, and API-error states.
- [ ] `pnpm --filter web lint` and `pnpm --filter web build` pass.
- [ ] Manual check at 320px, 768px, and 1440px shows exactly the expected public information.

**Dependencies:** Checkpoint: Public API ready.

**Files likely touched:**

- `web/src/types.ts`
- `web/src/app/(store)/page.tsx`
- `web/src/features/developers/seller-summary-card.tsx`
- `web/src/features/developers/*test.tsx`

**Estimated scope:** M (4 files).

### Checkpoint: End-to-end marketplace sellers

- [ ] A seller approved in MySQL and with published MongoDB scripts appears in section 07.
- [ ] A pending/suspended seller, or approved seller without published scripts, does not appear.
- [ ] Section 07 has no console errors and no sensitive seller data in the response or DOM.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Seller identity is MySQL but catalog scripts are MongoDB | High | Aggregate script metrics in MongoDB and hydrate seller identities in one explicit MySQL query; test disagreement between sources. |
| Current UI mock promises unsupported fields (avatar, bio, contact, per-seller detail URL) | High | Do not put these fields in v1. Render a safe summary card; design profile schema/API separately. |
| Metrics are semantically unclear | Medium | Define `popular` and weighted rating in the contract and cover them with fixtures. |
| Cross-store pagination can be inconsistent if a seller status changes during the request | Low | Filter MySQL status after aggregation; accept eventual consistency for a public browse endpoint and document it. |

## Open questions

1. Should section 07 show only the top three sellers (`limit=3`), or should this endpoint also be the source for the full `/developers` directory now?
2. Is an `APPROVED` seller allowed to be visually labelled "verified", or is a separate verification state required?
3. Which public profile fields should sellers be able to manage later (slug, avatar, bio, specialties), and who moderates them?
4. Is `downloads` the intended definition of popularity, or should ranking use a different business metric?

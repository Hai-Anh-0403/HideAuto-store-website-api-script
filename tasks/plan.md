# Implementation Plan: MongoDB-backed Script Store APIs

## Overview

Move marketplace-domain persistence to local MongoDB while retaining MySQL/Prisma for
identity and authentication. The first deliverable is a public script catalog API consumed
by `web`, then seller and admin script lifecycle APIs. This plan intentionally does not
change the upload security pipeline: original uploads are never persisted, and only
scrubbed graph references and derived metadata may be stored.

## Scope and ownership

| System | Owns | Does not own |
| --- | --- | --- |
| MySQL / Prisma | admins, sellers, seller sessions, passwords, JWT identity | script listings, versions, tags, keys, members, builds |
| MongoDB | scripts, versions, tags, keys, members, redemptions, devices, builds | passwords, seller/admin sessions, JWT credentials |
| Filesystem storage | scrubbed graph files, media, build artifacts | business metadata and access state |

MongoDB documents reference MySQL identities with immutable string IDs such as `sellerId`.
No MongoDB collection may duplicate passwords, session tokens, or a second source of truth
for a seller account.

## API contract decisions

- Preserve the existing `/api/v1` prefix and `{ detail, code }` error envelope.
- Public catalog routes are read-only and return only `PUBLISHED` scripts.
- All list endpoints use `skip` and `limit`; supported sort values are explicitly whitelisted.
- Query parameters and request bodies use camelCase.
- DTOs are defined before controllers and validated at the NestJS boundary.
- API response DTOs are added to `web/src/types.ts` before frontend mock data is replaced.

## Dependency graph

```text
Mongo connection and environment
          |
Mongo schemas and repository boundaries
          |
Script public DTOs and service queries
          |
Public catalog/detail controllers
          |
Frontend types and API client
          |
Catalog and detail pages without mock data
          |
Seller lifecycle, moderation, keys, members, builds
```

## Task list

### Phase 0: Contract and foundation

#### Task 1: Approve database ownership and public API contract

**Description:** Record the MySQL/MongoDB boundary and the exact catalog/detail response
shapes before editing persistence code.

**Acceptance criteria:**

- [x] MySQL ownership is limited to accounts, roles, passwords, and sessions.
- [x] MongoDB ownership is documented for every marketplace collection.
- [x] `GET /api/v1/store/scripts` and `GET /api/v1/store/scripts/:slug` request/response
  contracts are approved.

**Verification:**

- [ ] Team review confirms no field has two writable sources of truth.
- [ ] Public response excludes graph content, credential scan paths, seller email, and storage paths.

**Dependencies:** None.

**Files likely touched:**

- `docs/ARCHITECTURE_AND_API.md`
- `tasks/plan.md`

**Estimated scope:** Small.

#### Task 2: Add MongoDB application configuration

**Description:** Enable one NestJS MongoDB connection using `MONGO_URI` and fail fast with
a clear configuration error when it is absent or invalid.

**Acceptance criteria:**

- [x] Local URI defaults only in `.env.example`, never in application code.
- [x] Nest application creates one Mongoose connection at bootstrap.
- [x] MySQL authentication modules remain unchanged.

**Verification:**

- [ ] Start the server with a local MongoDB instance.
- [ ] `npx tsc --noEmit` and focused module tests pass.

**Dependencies:** Task 1.

**Files likely touched:**

- `server/src/app.module.ts`
- `server/src/config/*` or `server/src/mongo/*`
- `server/.env.example`

**Estimated scope:** Small.

#### Task 3: Define MongoDB script and tag schemas with indexes

**Description:** Create Mongoose schemas for public script data, approved versions, and
tags. Define indexes for slug lookup, catalog filtering, seller ownership, and search.

**Acceptance criteria:**

- [x] `ScriptDocument` has `sellerId` as a MySQL string reference, never a user object.
- [x] `slug` is unique; catalog indexes support `status`, `publishedAt`, `sellerId`, and tags.
- [x] Storage references point only to scrubbed artifacts.

**Verification:**

- [ ] Schema unit tests cover required fields, unique slug, and status values.
- [ ] MongoDB indexes are created on a fresh local database.

**Dependencies:** Task 2.

**Files likely touched:**

- `server/src/scripts/schemas/script.schema.ts`
- `server/src/scripts/schemas/script-version.schema.ts`
- `server/src/tags/schemas/tag.schema.ts`
- `server/src/scripts/scripts.module.ts`

**Estimated scope:** Medium.

### Checkpoint: Foundation

- [ ] Server starts with MySQL identity storage and MongoDB marketplace storage.
- [ ] No existing MySQL marketplace table is written by new code.
- [ ] Team reviews schemas and indexes before endpoint work begins.

### Phase 1: Public storefront vertical slice

#### Task 4: Define public store DTOs and response types

**Description:** Define separate list and detail response DTOs. Do not expose seller-only,
admin-only, or raw graph fields.

**Acceptance criteria:**

- [x] Summary response has name, slug, description, thumbnail, seller display name, tags,
  latest approved version, and public statistics.
- [x] Detail response DTO adds sanitized description, gallery, approved version history, and
  derived capabilities.
- [x] Pagination and sort query DTO validates allowlisted values only.

**Verification:**

- [ ] Swagger displays both endpoint contracts.
- [ ] DTO validation tests reject unsupported sort/filter fields.

**Dependencies:** Task 3.

**Files likely touched:**

- `server/src/store/dto/browse-scripts.dto.ts`
- `server/src/store/dto/store-script.dto.ts`
- `web/src/types.ts`

**Estimated scope:** Medium.

#### Task 5: Implement public catalog query

**Description:** Read published script summaries from MongoDB with search, tag filtering,
sorting, and skip/limit pagination.

**Acceptance criteria:**

- [x] Endpoint implementation returns only `PUBLISHED` scripts with an `APPROVED` latest version.
- [x] Search, tag filters, pagination, and every advertised sort order are deterministic.
- [x] Response shape matches Task 4 exactly.

**Verification:**

- [ ] Integration tests seed MongoDB and assert filters, sort order, and pagination totals.
- [ ] Anonymous request succeeds; seller/admin-only fields are absent.

**Dependencies:** Task 4.

**Files likely touched:**

- `server/src/store/store.service.ts`
- `server/src/store/store.controller.ts`
- `server/src/store/store.module.ts`
- `server/test/store-catalog.test.ts`

**Estimated scope:** Medium.

#### Task 6: Implement public script detail query

**Description:** Retrieve one published script by slug or MongoDB ID and return only its
approved version history.

**Acceptance criteria:**

- [x] Unknown, draft, archived, or non-published scripts return `404 script_not_found`.
- [x] Detail includes only approved versions and sanitized public fields.
- [x] The latest approved version is explicit and stable.

**Verification:**

- [ ] Integration tests cover slug lookup, ID lookup, and each hidden status.
- [ ] Response validates against the frontend type.

**Dependencies:** Task 5.

**Files likely touched:**

- `server/src/store/store.service.ts`
- `server/src/store/store.controller.ts`
- `server/test/store-detail.test.ts`

**Estimated scope:** Small.

#### Task 7: Replace catalog and detail mock reads in the web

**Description:** Use `web/src/lib/api.ts` and `useFetch` in storefront features while
retaining the existing visual design. Keep mock data only as temporary seed fixtures.

**Acceptance criteria:**

- [x] `/`, `/scripts`, and `/scripts/:slug` render API data.
- [x] Loading, empty, and API-error states are localized.
- [x] No public page imports the runtime mock catalog data.

**Verification:**

- [ ] Manual check with seeded MongoDB scripts.
- [x] `cd web && npx tsc --noEmit && pnpm lint && pnpm build` passes.

**Dependencies:** Tasks 5 and 6.

**Files likely touched:**

- `web/src/features/catalog/*`
- `web/src/features/home/*`
- `web/src/app/(store)/scripts/*`
- `web/src/types.ts`

**Estimated scope:** Large; split catalog and detail into separate pull requests if needed.

### Checkpoint: Public storefront

- [ ] Published MongoDB scripts appear on the home page and catalog.
- [ ] Detail pages display the same script selected from the catalog.
- [ ] A draft script cannot be obtained through public API or direct URL.

### Phase 2: Seller lifecycle vertical slices

#### Task 8: Move seller-owned script create and update persistence to MongoDB

**Description:** Keep JWT seller authentication in MySQL but persist the sanitized script
listing and its first pending version in MongoDB.

**Acceptance criteria:**

- [ ] Only an approved MySQL seller can create or update its own MongoDB scripts.
- [ ] Upload pipeline stores only scrubbed graph references and derived metadata.
- [ ] MongoDB writes are atomic within the script/version lifecycle where possible.

**Verification:**

- [ ] Existing graph scrub tests pass.
- [ ] Integration test verifies a seller cannot write another seller's script.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:**

- `server/src/scripts/scripts.service.ts`
- `server/src/scripts/schemas/*`
- `server/test/scripts-mongo.test.ts`

**Estimated scope:** Large; split create and update-version paths if implementation exceeds five files.

#### Task 9: Move admin review and publish state to MongoDB

**Description:** Persist review decisions in MongoDB while retaining MySQL admin identity
and guards. Publishing changes the document visible to the public catalog.

**Acceptance criteria:**

- [ ] Only MySQL-authenticated admins can approve or reject MongoDB versions.
- [ ] Approval remains blocked if embedded credentials are present.
- [ ] Rejecting an update never unpublishes the previous approved version.

**Verification:**

- [ ] Admin integration tests cover approve, reject, credentials gate, and rollback behavior.
- [ ] Public catalog reflects only the approved version after review.

**Dependencies:** Task 8.

**Files likely touched:**

- `server/src/admin/admin.service.ts`
- `server/src/scripts/scripts.service.ts`
- `server/test/admin-review-mongo.test.ts`

**Estimated scope:** Medium.

### Phase 3: Entitlements and artifacts

#### Task 10: Move keys, members, redemptions, and devices to MongoDB

**Description:** Store marketplace entitlement state in MongoDB while retaining seller
authorization in MySQL and buyer identity from Flowdesk.

**Acceptance criteria:**

- [ ] Key redemption and membership updates are transaction-safe.
- [ ] Shop-wide and script-specific keys remain supported.
- [ ] Blocked devices prevent licence issuance.

**Verification:**

- [ ] Focused key and licence tests pass against MongoDB.
- [ ] Concurrent redeem test cannot exceed a key's `maxUses`.

**Dependencies:** Task 9.

**Files likely touched:**

- `server/src/keys/*`
- `server/src/members/*`
- `server/src/app-client/*`
- `server/test/keys-mongo.test.ts`

**Estimated scope:** Large; implement keys and members as separate tasks if needed.

#### Task 11: Move build metadata to MongoDB and retire MySQL marketplace writes

**Description:** Persist build metadata in MongoDB and remove remaining Prisma writes for
marketplace resources after all flows have MongoDB coverage.

**Acceptance criteria:**

- [ ] Build records reference MongoDB script/version IDs consistently.
- [ ] No new runtime path writes MySQL marketplace tables.
- [ ] Existing files continue to use `StorageService` references.

**Verification:**

- [ ] End-to-end seller upload → review → public listing → buyer entitlement flow passes.
- [ ] Database access audit confirms Prisma is used only by identity modules.

**Dependencies:** Task 10.

**Files likely touched:**

- `server/src/builds/*`
- `server/src/scripts/*`
- `server/prisma/schema.prisma`
- `server/test/builds-mongo.test.ts`

**Estimated scope:** Large; complete only after team migration review.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Dual MySQL/MongoDB writes create inconsistent data | High | Assign one source of truth per resource; use MySQL only for identity IDs. |
| Public API leaks graph or scan data | High | Separate public DTOs and contract tests; use explicit Mongo projections. |
| MongoDB counters lose updates | Medium | Use atomic `$inc` and transactions for bounded key redemptions. |
| Storefront expects mock-only fields | Medium | Map UI to real contract or add an approved source field; do not invent data. |
| Existing MySQL services are migrated all at once | High | Deliver public catalog first, then seller lifecycle, then entitlement. |

## Open questions requiring team approval

- Is MongoDB the source of truth for `tags`, `keys`, `members`, and `miniAppBuilds`, as well as scripts?
- Should seller public profile fields remain in MySQL and be read dynamically, or be copied as a MongoDB public projection?
- Which UI fields are real product requirements: price, category, platform, seller contact, watch count?
- Are existing MySQL marketplace rows disposable development data, or must they be migrated into MongoDB?
- Is MongoDB replica-set mode available locally and in deployment for transactions?

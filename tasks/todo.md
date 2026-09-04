# MongoDB Script Store API — Task Checklist

## Phase 0: Contract and foundation

- [x] 1. Review and approve `tasks/spec-mongodb-phase-0.md`.
- [x] 2. Add MongoDB application configuration.
- [x] 3. Define MongoDB script and tag schemas with indexes.

## Checkpoint: Foundation

- [x] Server starts with both databases and no new marketplace write goes to MySQL (requires local MongoDB runtime check).
- [x] Schema/index review completed.

## Phase 1: Public storefront

- [x] 4. Review and approve `tasks/spec-public-store-api-phase-1.md`, then define public store DTOs and frontend response types.
- [x] 5. Implement public MongoDB catalog query (unit-tested; local MongoDB integration check pending).
- [x] 6. Implement public MongoDB script detail query (unit-tested; local MongoDB integration check pending).
- [x] 7. Replace storefront catalog/detail mock reads with API calls.

## Checkpoint: Public storefront

- [ ] Published scripts are visible through the web storefront.
- [ ] Draft and archived scripts are inaccessible publicly.

## Phase 2: Seller lifecycle

- [ ] 8. Move seller-owned script creation and version persistence to MongoDB (spec: `tasks/spec-script-lifecycle-mongodb.md`).
- [ ] 9. Move admin review and publish state to MongoDB (spec: `tasks/spec-script-lifecycle-mongodb.md`).

## Phase 3: Entitlements and artifacts

- [ ] 10. Move keys, members, redemptions, and devices to MongoDB.
- [ ] 11. Move build metadata and retire MySQL marketplace writes.

## Required approval before implementation

- [ ] Team approves the ownership boundary and public API contract in `tasks/plan.md`.
- [ ] Team confirms migration policy for existing MySQL marketplace data.
- [ ] Team confirms whether MongoDB transactions are available in target environments.

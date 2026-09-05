# MongoDB public sellers — task checklist

## Phase 1: Seller read model

- [x] Task 1 — Add the indexed MongoDB `MarketplaceSeller` schema with public fields only.
- [x] Task 2 — Project registration and seller-status changes from MySQL into MongoDB; add reconciliation/backfill.
- [x] Checkpoint — Backfill completed; 5 sellers have one-to-one IDs, synchronized statuses, and public-only MongoDB documents.

## Phase 2: Public API

- [x] Task 3 — Define DTOs and Swagger contract for anonymous `GET /api/v1/store/sellers`.
- [x] Task 4 — Add Mongo-only seller/script aggregation and focused endpoint tests.
- [x] Checkpoint — Live endpoint returned HTTP 200; Swagger has no bearer operation security and the seller query is Mongo-only.

## Phase 3: Section 07

- [x] Task 5 — Replace home mock sellers with public MongoDB API data and resilient UI states.
- [x] Checkpoint — Production web build passed; section 07 renders API-derived public fields only.

## Approval required before implementation

- [ ] Confirm whether MongoDB is only the public seller read model (the assumed scope) or must also replace MySQL authentication and seller operations.

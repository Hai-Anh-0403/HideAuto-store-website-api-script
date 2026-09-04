# Phase 1 Specification: Public Script Store API Contract

## Objective

Replace static catalog data with a read-only public API backed by MongoDB, without
exposing seller identity records, storage keys, scrubbed graphs, credential scans, or
unapproved submissions.

This document specifies the contract before the MongoDB query implementation begins.

## Routes

| Method | Route | Access | Behaviour |
| --- | --- | --- | --- |
| `GET` | `/api/v1/store/scripts` | Anonymous | Returns a paginated list of published script summaries. |
| `GET` | `/api/v1/store/scripts/:slugOrId` | Anonymous | Returns one published script by slug or MongoDB ObjectId. |

The existing `{ detail, code }` error envelope remains unchanged. A missing, draft,
pending-review, rejected, or archived script returns `404` with code
`script_not_found`.

## Query contract

`GET /api/v1/store/scripts` accepts only camel-case query parameters.

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `skip` | integer | `0` | Minimum `0`. |
| `limit` | integer | `20` | Range `1..100`. |
| `q` | string | omitted | Searches name and short description. |
| `tagIds` | comma-separated MongoDB tag IDs | omitted | AND semantics: a script must have every requested tag. |
| `sort` | enum | `popular` | One of `popular`, `newest`, `updated`, `views`. |

Sort ordering is deterministic:

- `popular`: `ratingAvg DESC`, then `ratingCount DESC`, then `publishedAt DESC`.
- `newest`: `publishedAt DESC`, then `_id DESC`.
- `updated`: `updatedAt DESC`, then `_id DESC`.
- `views`: `views DESC`, then `publishedAt DESC`.

The legacy `tag_ids` parameter is not part of the new contract. It may be retained as a
temporary compatibility alias only while the current Prisma-backed endpoint remains live.

## Response contract

All dates are ISO-8601 strings. `thumbnailUrl` and `galleryUrls` are public media URLs;
the filesystem storage keys used to create them never appear in a response.

```ts
interface PublicTag {
  id: string;
  name: string;
  slug: string;
}

interface PublicScriptStatistics {
  ratingAvg: number;
  ratingCount: number;
  downloads: number;
  views: number;
}

interface PublicScriptSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  seller: { displayName: string };
  tags: PublicTag[];
  latestApprovedVersion: string;
  statistics: PublicScriptStatistics;
  publishedAt: string;
  updatedAt: string;
}

interface PublicScriptVersion {
  id: string;
  version: string;
  changelog: string | null;
  releasedAt: string | null;
  createdAt: string;
}

interface PublicScriptDetail extends PublicScriptSummary {
  descriptionHtml: string | null;
  galleryUrls: string[];
  capabilities: string[];
  versions: PublicScriptVersion[]; // APPROVED only, newest first
}
```

Catalog response uses the established pagination envelope:

```ts
interface Page<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
```

## Required MongoDB model additions

The foundation schemas intentionally contained only the persistence and security minimum.
Before Task 5, extend them with the public fields below, all with safe defaults:

| Collection | Fields |
| --- | --- |
| `scripts` | `ratingAvg`, `ratingCount`, `downloads`, `views` (all numeric `0`) |
| `script_versions` | `changelog`, `releasedAt` |

`latestApprovedVersionId` is the sole authoritative pointer to the public version. The
query must verify that its version document is `APPROVED`; it must not expose a pending
version merely because a pointer was written incorrectly.

Seller display name is resolved read-only from MySQL by `sellerId` in Phase 1. MongoDB
does not duplicate seller contact details or login data.

## Mapping from imported frontend mock data

The imported UI currently relies on fields that are not part of the marketplace domain.
They must be removed from the runtime UI, replaced with a defined business field, or
explicitly added in a later product scope; the API must not fabricate them.

| Mock field | Decision for Phase 1 |
| --- | --- |
| `name`, `outcome` | Map to `name`, `shortDescription`. |
| `version`, `updated`, `seller`, `views` | Map to `latestApprovedVersion`, `updatedAt`, `seller.displayName`, `statistics.views`. |
| Unsplash `image` | Replace with `thumbnailUrl`; use a local neutral placeholder if null. |
| `price`, `watches`, `status` marketing label | Remove from live runtime UI; no authenticated pricing or watch-list feature exists. |
| `category`, `platform`, `runtime` | Remove from runtime filters until a product-owned taxonomy/capability model is approved. Tags and derived `capabilities` remain usable. |

## Security boundaries

Public projections must not include:

- `sellerId`, seller email, seller contact, roles, passwords, or sessions;
- graph content, graph storage keys, source filenames, checksums, credential scan results,
  or review notes;
- unpublished versions, rejection reasons, or internal workflow capability details beyond
  the approved `capabilities` string list.

## Test-first verification

Before implementation:

1. Add DTO validation tests that reject unsupported `sort`, invalid pagination, and
   non-string `tagIds`.
2. Add mapping/projection tests that ensure disallowed fields cannot appear in either
   public response type.
3. In Task 5, add MongoDB-backed catalog integration tests for status filtering, search,
   tag AND filtering, each sort order, and pagination.
4. In Task 6, add detail tests for slug/ObjectId lookup and invisible statuses.

## Approval needed

Approve this API contract and, specifically, the decision to remove unbacked mock fields
(`price`, `watches`, marketing status, category/platform/runtime filters) from the live
storefront rather than inventing MongoDB data for them. After approval, Task 4 will add
the DTOs and frontend types, followed by the MongoDB catalog implementation.

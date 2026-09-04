# Phase 0 Specification: MongoDB Marketplace Foundation

## Objective

Establish a single MongoDB connection and the minimal, indexed document model required
to move marketplace data away from MySQL. This phase creates no public API endpoint,
does not migrate existing data, and does not alter the upload, review, or download
behaviour.

## Confirmed ownership boundary

| Store | Owns | Explicitly must not own |
| --- | --- | --- |
| MySQL through Prisma | admin and seller accounts, roles/statuses, passwords, authentication sessions, JWT identity | scripts, versions, tags, keys, memberships, redemptions, devices, build metadata |
| MongoDB | marketplace records named in the previous column | passwords, session tokens, JWT secrets, full admin/seller account documents |
| Filesystem (`STORAGE_DIR`) | scrubbed workflow graphs, approved build artifacts, media files | listing metadata, version state, access/entitlement state |

Every MongoDB document that belongs to a seller stores `sellerId` as the immutable
MySQL ID string. It must never embed a seller email, password hash, session token, or
an independently writable seller profile.

## Existing baseline

- `server/.env.example` already declares `MONGO_URI=mongodb://localhost:27017/hide_auto`.
- `@nestjs/mongoose` and `mongoose` are already installed.
- `AppModule` currently configures global `ConfigModule` and Prisma, but does not create
  a Mongoose connection.
- Marketplace modules currently still import `PrismaModule`; replacing their persistence
  is intentionally out of scope for this phase.

## Deliverables

1. One global NestJS Mongoose connection configured solely by `MONGO_URI`.
2. A fail-fast configuration error when `MONGO_URI` is absent, blank, or malformed.
3. Mongoose schemas and indexes for `scripts`, `script_versions`, and `tags`.
4. Module registrations that make these models available to later services without
   changing existing controllers or service behaviour.
5. Focused tests that prove the configuration boundary and schema/index definitions.

## Document contracts

### `scripts`

This is the aggregate root and public listing record.

```ts
type ScriptStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

interface ScriptDocument {
  _id: ObjectId;
  sellerId: string;                 // MySQL seller ID; no populated account document
  slug: string;                     // globally unique, immutable after first publish
  name: string;
  shortDescription: string;
  descriptionHtml?: string;         // sanitized only; never raw graph content
  status: ScriptStatus;
  tagIds: ObjectId[];
  thumbnailStorageKey?: string;     // filesystem storage reference, not an absolute path
  galleryStorageKeys: string[];
  latestApprovedVersionId?: ObjectId;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

Required indexes:

- `{ slug: 1 }`, unique.
- `{ status: 1, publishedAt: -1 }` for public catalog ordering.
- `{ sellerId: 1, updatedAt: -1 }` for seller-owned listings.
- `{ tagIds: 1, status: 1, publishedAt: -1 }` for tag-filtered public catalog queries.

No graph JSON, original upload filename/path, credential scan output, licence material, or
seller contact details may be added to this document.

### `script_versions`

One document per seller submission/version. A version is always associated with one
script and one seller identity.

```ts
type VersionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETIRED';

interface ScriptVersionDocument {
  _id: ObjectId;
  scriptId: ObjectId;
  sellerId: string;
  version: string;
  status: VersionStatus;
  scrubbedGraphStorageKey: string;  // content-addressed filesystem key only
  capabilities: string[];           // derived metadata only
  review: {
    reviewedByAdminId?: string;
    reviewedAt?: Date;
    rejectionReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

Required indexes:

- `{ scriptId: 1, version: 1 }`, unique.
- `{ scriptId: 1, status: 1, createdAt: -1 }` for approved-version lookup and review.
- `{ sellerId: 1, createdAt: -1 }` for seller history.

Only an approved version can be assigned to `scripts.latestApprovedVersionId` in a later
lifecycle phase. Phase 0 does not implement this transition.

### `tags`

```ts
interface TagDocument {
  _id: ObjectId;
  slug: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Required index: `{ slug: 1 }`, unique.

## Implementation boundaries

- Add Mongoose connection setup and schema registration only.
- Retain existing Prisma models, Prisma module imports, controllers, routes, guards,
  error envelope, and response shapes unchanged.
- Do not write to either MongoDB or MySQL during normal application bootstrap beyond
  MongoDB's automatic index creation in development/testing.
- Do not add a data migration, dual-write path, seed data, or frontend change.
- Do not place cross-feature schemas in a generic `models` directory. Keep script/version
  schemas in `src/scripts/schemas` and the tag schema in `src/tags/schemas`.

## Validation and test strategy

Follow test-driven slices:

1. Add a failing configuration test for missing/invalid `MONGO_URI`, then add connection
   configuration until it passes.
2. Add failing schema tests for required fields, enum validation, and declared indexes,
   then add the schema implementation.
3. Run the existing server tests to confirm MySQL-backed identity behaviour remains intact.

Required commands from `server/`:

```powershell
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

When local MongoDB is running, also start the server with its existing command and confirm
that it opens exactly one Mongoose connection:

```powershell
pnpm dev
```

## Success criteria

- The server starts when both `DATABASE_URL` and a valid local `MONGO_URI` are present.
- It refuses to start with a clear, non-secret-bearing message when `MONGO_URI` is not
  configured or is invalid.
- The three collections have the fields and indexes declared above.
- No existing HTTP endpoint changes behaviour in Phase 0.
- TypeScript, lint, and existing tests pass.

## Decisions needed before code implementation

- **Migration policy:** Existing MySQL marketplace data is treated as disposable local
  development data unless the team explicitly requires a one-off import.
- **Transactions:** A local standalone MongoDB is sufficient for Phase 0. Replica-set
  configuration is required before Phase 3, where atomic entitlement redemption needs
  MongoDB transactions.
- **Public seller fields:** The public API will resolve seller display information from
  MySQL in Phase 1 rather than duplicating it in MongoDB. Caching/projection is a later
  performance decision.

Approval of these three decisions and this document unlocks the configuration and schema
work described above.

# Script Lifecycle Persistence: MongoDB Migration Specification

## Scope

Move script and script-version persistence from Prisma/MySQL to MongoDB while retaining
MySQL exclusively for seller/admin accounts, authentication, authorization guards, and
seller display-name lookup.

In scope:

- seller list, create, update, submit, archive, unarchive, and create-version operations;
- admin pending-review list, approve-version, and reject-version operations;
- the public store catalog/detail endpoints already added in Phase 1.

Out of scope:

- keys, members, redemptions, devices, builds, and frontend rendering;
- migration of old local MySQL development records;
- account/session data in MongoDB.

## Required document fields

`Script` remains the aggregate root. In addition to its public fields it needs:

- `rejectReason`, `hasMiniApp`, and non-sensitive derived metadata (`nodeCount`,
  `nodeGroupsUsed`, `capabilities`);
- `latestApprovedVersionId` as the only public-version pointer;
- `latestSubmittedVersionId` only if needed to preserve portal UX; it must never be used
  by the public API.

`ScriptVersion` needs the scrubbed artifact reference and review-safe derived metadata:

- `scrubbedGraphStorageKey`, source filename, delivery, graph-extracted flag;
- node count/groups, derived capabilities, required variable names, and credential scan
  counts/paths (never credential values);
- status, review admin ID, review timestamp, rejection reason, release timestamp.

No original archive/installer bytes, passwords, seller email, session, JWT, or credential
values may be persisted.

## Lifecycle invariants

1. Seller create writes one `DRAFT` script and one `PENDING_REVIEW` version to MongoDB.
2. Submit moves only a `DRAFT` or `REJECTED` script to `PENDING_REVIEW` when it has a
   pending version.
3. Admin approval refuses a version without a scrubbed artifact or with credentials found.
4. Approval atomically changes the version to `APPROVED`, assigns it as the latest approved
   version, and publishes the script unless it is archived.
5. Rejection marks the version `REJECTED`; it only marks the script `REJECTED` when no
   approved version exists.
6. Seller ownership is always checked as MongoDB `sellerId === JWT seller ID`.
7. Public queries use only `PUBLISHED` scripts whose latest-version pointer references an
   `APPROVED` version.

## Implementation order

1. Extend schema fields and indexes, with schema tests.
2. Add a Mongo script repository and migrate seller create/list/find/update/version/submit
   methods in small test-driven slices.
3. Migrate admin pending list and approve/reject using a MongoDB transaction when the
   deployment provides a replica set; otherwise use guarded conditional updates.
4. Remove obsolete Prisma script/version reads after each endpoint has MongoDB coverage.
5. Verify upload → submit → approve → public catalog with a local MongoDB instance.

## Compatibility

Endpoint paths and JSON field names stay unchanged where their data still applies. MongoDB
ObjectIds are serialized as strings. Existing MySQL script rows are not read or copied;
local testing uses newly uploaded MongoDB records.

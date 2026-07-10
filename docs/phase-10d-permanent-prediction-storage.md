# Phase 10D — Permanent prediction storage

Phase 10D adds the permanent PostgreSQL storage boundary for the MatchPulse prediction architecture. The repository uses the existing root Prisma schema at `prisma/schema.prisma`, which is the schema referenced by `apps/api/package.json`.

## Tables

- `prediction_feature_snapshots` stores versioned, validated `PredictionFeatureBundleV1` snapshots and searchable match context.
- `odds_intelligence_assessments`, `odds_intelligence_markets`, and `odds_intelligence_selections` store the validated internal Odds Intelligence assessment aggregate.
- `prediction_snapshots` stores validated `FinalPredictionSnapshot` records.
- `prediction_specialist_contributions` stores the immutable specialist contribution rows for a prediction.
- `prediction_label_revisions` stores append-only label history.
- `prediction_evaluations` stores immutable evaluation contracts.
- `feature_schema_registry` and `label_schema_registry` store schema metadata.
- `training_dataset_registry` stores sealed dataset metadata and private manifest references.
- `model_registry_entries` stores model artifact metadata and private artifact references.

The important searchable fields are relational columns. Complete validated internal contracts are retained in JSON columns, together with deterministic SHA-256 content hashes. Dataset bytes, model binaries, weights, coefficients, secrets, provider authentication data, raw provider payloads, and raw Odds rows are not stored in these new tables.

## Immutability and idempotency

Feature snapshots, Odds assessments and their children, final predictions, specialist contributions, evaluations, schema versions, sealed datasets, and model entries are immutable after creation. Label updates are append-only revisions; earlier rows are never overwritten.

The storage hash canonicalizes objects recursively with sorted keys, preserves array order, and rejects undefined values, non-finite numbers, functions, symbols, bigint values, invalid dates, and cycles. Repeating the same natural identity with the same content hash is idempotent. Reusing an immutable identity with different content raises a typed `PredictionStorageConflictError`.

Label revisions progress as follows:

```text
pending → pending | partial | complete | invalid
partial → partial | complete | invalid
complete → complete
invalid → invalid
```

Revision numbers are positive integers. Reads reconstruct the domain payload and run the existing validator. Persisted invalid JSON is reported as `PredictionStorageInvariantError`; it is never silently repaired.

## Cross-record validation

Final predictions require the linked feature snapshot to exist. Fixture IDs, feature versions, feature hashes, feature counts, and timestamp ordering are checked before persistence. An optional Odds assessment must exist, match the fixture and Odds Intelligence version, and match its stored usability and reliability reference.

The locked Odds invariant remains:

```text
No odds data influences a prediction before its validity, freshness,
market completeness, provider agreement, anomaly status, and reliability
have been assessed.
```

When an Odds assessment is linked, `assignedMarketWeight` cannot exceed the stored `recommendedMarketModelWeight` by more than `1e-6`. When no usable assessment exists, the stored prediction must have `oddsUsableForModel = false` and `assignedMarketWeight = 0`.

Evaluations require the referenced prediction and at least one stored label revision for the declared label version. Registry registrations require their declared feature, label, and dataset references to exist; model feature and label versions must match the dataset.

## Migration and operations

The migration is additive and was generated offline at:

`prisma/migrations/20260710140000_permanent_prediction_storage/migration.sql`

It adds only new tables, indexes, unique constraints, foreign keys, and scalar `CHECK` constraints. It was generated but not applied to Neon during this phase.

The exact later application command is:

```powershell
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
```

Before applying it, review the SQL against the target database and take the normal Neon backup/PITR precautions. The migration has no application rollback function; rollback should be handled by a reviewed forward migration or an approved database recovery procedure. Neon PITR/history is an operational recovery mechanism, not application data retention.

No public API routes, server routes, frontend, worker, scheduler, prediction calculations, Odds calculations, provider-quality algorithms, model training, or artifact upload logic were added. The next phase is the final Odds Intelligence analysis engine.

## Phase 10D-H Coverage Matrix

| Invariant ID | Storage Area | Invariant | Exact Test Name | Implemented In | Status |
|---|---|---|---|---|---|
| D-1 | Hashing | Same flat object with different key order produces identical canonical form | hash-1: same flat object with different key order produces identical canonical form | prediction-storage-hash.test.ts | Verified |
| D-2 | Hashing | Same nested object with different key order produces identical hash | hash-2: same nested object with different key order produces identical hash | prediction-storage-hash.test.ts | Verified |
| D-3 | Hashing | Array element order is preserved in canonical form | hash-3: array element order is preserved in canonical form | prediction-storage-hash.test.ts | Verified |
| D-4 | Hashing | Different arrays produce different hashes | hash-4: different arrays produce different hashes | prediction-storage-hash.test.ts | Verified |
| D-5 | Hashing | Different numbers produce different hashes | hash-5: different numbers produce different hashes | prediction-storage-hash.test.ts | Verified |
| D-6 | Hashing | 0 and -0 produce identical hashes | hash-6: 0 and -0 produce identical hashes (JSON.stringify treats them the same) | prediction-storage-hash.test.ts | Verified |
| D-7 | Hashing | Undefined root value throws TypeError | hash-7: undefined root value throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-8 | Hashing | Undefined nested property throws TypeError | hash-8: undefined nested property throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-9 | Hashing | Undefined array element throws TypeError | hash-9: undefined array element throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-10 | Hashing | NaN throws TypeError | hash-10: NaN throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-11 | Hashing | Positive Infinity throws TypeError | hash-11: Positive Infinity throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-12 | Hashing | Negative Infinity throws TypeError | hash-12: Negative Infinity throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-13 | Hashing | BigInt value throws TypeError | hash-13: BigInt value throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-14 | Hashing | Function value throws TypeError | hash-14: function value throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-15 | Hashing | Symbol value throws TypeError | hash-15: symbol value throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-16 | Hashing | Cyclic object throws TypeError | hash-16: cyclic object throws TypeError | prediction-storage-hash.test.ts | Verified |
| D-17 | Hashing | Date handling is deterministic via ISO string | hash-17: Date handling is deterministic via ISO string | prediction-storage-hash.test.ts | Verified |
| D-18 | Hashing | Input object is not mutated by canonicalization or hashing | hash-18: input object is not mutated by canonicalization or hashing | prediction-storage-hash.test.ts | Verified |
| D-19 | Hashing | Hash output is lowercase hexadecimal | hash-19: hash output is lowercase hexadecimal | prediction-storage-hash.test.ts | Verified |
| D-20 | Hashing | Hash length is 64 characters (SHA-256) | hash-20: hash length is 64 characters (SHA-256) | prediction-storage-hash.test.ts | Verified |
| F-1 | Feature | Valid feature snapshot saves | test-1: Valid feature snapshot saves | prediction-storage.test.ts | Verified |
| F-2 | Feature | Builder validation runs before database access | test-2: Builder validation runs before database access | prediction-storage.test.ts | Verified |
| F-3 | Feature | Fixture mismatch fails | test-3: Fixture mismatch fails | prediction-storage.test.ts | Verified |
| F-8 | Feature | Same ID and same content is idempotent | test-8: Same ID and same content is idempotent | prediction-storage.test.ts | Verified |
| F-9 | Feature | Same ID and changed content conflicts | test-9: Same ID and changed content conflicts | prediction-storage.test.ts | Verified |
| F-10 | Feature | Read returns reconstructed validated domain data | test-10: Read returns reconstructed validated domain data | prediction-storage.test.ts | Verified |
| F-11 | Feature | Corrupt persisted payload causes invariant error | test-11: Corrupt persisted payload causes invariant error | prediction-storage.test.ts | Verified |
| F-12 | Feature | Missing record returns null result | test-12: Missing record returns null result | prediction-storage.test.ts | Verified |
| F-13 | Feature | Fixture list defaults to limit 50 | test-13: Fixture list defaults to limit 50 | prediction-storage.test.ts | Verified |
| F-14 | Feature | Limit 1 is accepted | test-14: Limit 1 is accepted | prediction-storage.test.ts | Verified |
| F-15 | Feature | Limit 200 is accepted | test-15: Limit 200 is accepted | prediction-storage.test.ts | Verified |
| F-16 | Feature | Limit 0 is rejected | test-16: Limit 0 is rejected | prediction-storage.test.ts | Verified |
| F-17 | Feature | Limit 201 is rejected | test-17: Limit 201 is rejected | prediction-storage.test.ts | Verified |
| F-18 | Feature | Results are newest-first | test-18: Results are newest-first | prediction-storage.test.ts | Verified |
| F-19 | Feature | Equal timestamps use stable ID ordering | test-19: Equal timestamps use stable ID ordering | prediction-storage.test.ts | Verified |
| F-20 | Feature | Cursor/before validation is enforced | test-20: Cursor/before validation is enforced | prediction-storage.test.ts | Verified |
| G-21 | Odds | Valid assessment persists | test-21: Valid assessment persists | prediction-storage.test.ts | Verified |
| G-22 | Odds | Root/market/selection transaction is used | test-22: Root/market/selection transaction is used | prediction-storage.test.ts | Verified |
| G-23 | Odds | Selection failure rolls back the aggregate | test-23: Selection failure rolls back the aggregate | prediction-storage.test.ts | Verified |
| G-24 | Odds | Domain validator runs before persistence | test-24: Domain validator runs before persistence | prediction-storage.test.ts | Verified |
| G-25 | Odds | Same assessment and same hash is idempotent | test-25: Same assessment and same hash is idempotent | prediction-storage.test.ts | Verified |
| G-26 | Odds | Same assessment ID with changed payload conflicts | test-26: Same assessment ID with changed payload conflicts | prediction-storage.test.ts | Verified |
| G-27 | Odds | Root market counts are preserved | test-27: Root market counts are preserved | prediction-storage.test.ts | Verified |
| G-28 | Odds | Selection counts are preserved | test-28: Selection counts are preserved | prediction-storage.test.ts | Verified |
| G-29 | Odds | Primary market is preserved | test-29: Primary market is preserved | prediction-storage.test.ts | Verified |
| G-30 | Odds | Internal assessment read is revalidated | test-30: Internal assessment read is revalidated | prediction-storage.test.ts | Verified |
| G-31 | Odds | Corrupt assessment payload causes invariant error | test-31: Corrupt assessment payload causes invariant error | prediction-storage.test.ts | Verified |
| G-32 | Odds | Raw Odds input is not accepted by the repository API | test-32: Raw Odds input is not accepted by the repository API | prediction-storage.test.ts | Verified |
| G-33 | Odds | Provider payload is rejected before storage | test-33: Provider payload is rejected before storage | prediction-storage.test.ts | Verified |
| G-34 | Odds | Fixture list is bounded | test-34: Fixture list is bounded | prediction-storage.test.ts | Verified |
| G-35 | Odds | Newest-first stable ordering is enforced | test-35: Newest-first stable ordering is enforced | prediction-storage.test.ts | Verified |
| H-36 | Prediction | Valid final prediction persists | test-36: Valid final prediction persists | prediction-storage.test.ts | Verified |
| H-37 | Prediction | Feature snapshot is required | test-37: Feature snapshot is required | prediction-storage.test.ts | Verified |
| H-38 | Prediction | Feature fixture must match | test-38: Feature fixture must match | prediction-storage.test.ts | Verified |
| H-42 | Prediction | Missing Odds assessment fails when referenced | test-42: Missing Odds assessment fails when referenced | prediction-storage.test.ts | Verified |
| H-50 | Prediction | Assigned market weight above recommendation fails | test-50: Assigned market weight above recommendation fails | prediction-storage.test.ts | Verified |
| H-53 | Prediction | Prediction and specialists persist transactionally | test-53: Prediction and specialists persist transactionally | prediction-storage.test.ts | Verified |
| H-54 | Prediction | Specialist failure rolls back prediction | test-54: Specialist failure rolls back prediction | prediction-storage.test.ts | Verified |
| H-55 | Prediction | Same prediction and same hash is idempotent | test-55: Same prediction and same hash is idempotent | prediction-storage.test.ts | Verified |
| H-56 | Prediction | Same snapshot ID with changed payload conflicts | test-56: Same snapshot ID with changed payload conflicts | prediction-storage.test.ts | Verified |
| H-57 | Prediction | Prediction read is reconstructed and revalidated | test-57: Prediction read is reconstructed and revalidated | prediction-storage.test.ts | Verified |
| H-58 | Prediction | Corrupt persisted prediction causes invariant error | test-58: Corrupt persisted prediction causes invariant error | prediction-storage.test.ts | Verified |
| I-60 | Label | First pending revision persists | test-60: First pending revision persists | prediction-storage.test.ts | Verified |
| I-64 | Label | Pending to complete is allowed | test-64: Pending to complete is allowed | prediction-storage.test.ts | Verified |
| I-70 | Label | Complete to partial is rejected | test-70: Complete to partial is rejected | prediction-storage.test.ts | Verified |
| I-72 | Label | Complete to invalid is rejected | test-72: Complete to invalid is rejected | prediction-storage.test.ts | Verified |
| I-78 | Label | Prediction snapshot must exist | test-78: Prediction snapshot must exist | prediction-storage.test.ts | Verified |
| I-81 | Label | Same revision and same hash is idempotent | test-81: Same revision and same hash is idempotent | prediction-storage.test.ts | Verified |
| I-82 | Label | Same revision with changed content conflicts | test-82: Same revision with changed content conflicts | prediction-storage.test.ts | Verified |
| J-86 | Evaluation | Valid evaluation persists | test-86: Valid evaluation persists | prediction-storage.test.ts | Verified |
| J-87 | Evaluation | Prediction snapshot must exist (eval) | test-87: Prediction snapshot must exist (eval) | prediction-storage.test.ts | Verified |
| K-97 | Registry | Feature schema registration succeeds | registry-97: Feature schema registration succeeds | prediction-registry-storage.test.ts | Verified |
| K-98 | Registry | Identical feature schema registration is idempotent | registry-98: Identical feature schema registration is idempotent | prediction-registry-storage.test.ts | Verified |
| K-99 | Registry | Same feature version with different schema conflicts | registry-99: Same feature version with different schema conflicts | prediction-registry-storage.test.ts | Verified |
| K-100 | Registry | Label schema registration succeeds | registry-100: Label schema registration succeeds | prediction-registry-storage.test.ts | Verified |
| K-101 | Registry | Identical label registration is idempotent | registry-101: Identical label registration is idempotent | prediction-registry-storage.test.ts | Verified |
| K-102 | Registry | Same label version with changed schema conflicts | registry-102: Same label version with changed schema conflicts | prediction-registry-storage.test.ts | Verified |
| K-103 | Registry | Dataset requires feature schema | registry-103: Dataset requires feature schema | prediction-registry-storage.test.ts | Verified |
| K-104 | Registry | Dataset requires label schema | registry-104: Dataset requires label schema | prediction-registry-storage.test.ts | Verified |
| K-105 | Registry | Dataset version is immutable | registry-105: Dataset version is immutable | prediction-registry-storage.test.ts | Verified |
| K-106 | Registry | Dataset count fields are validated | registry-106: Dataset count fields are validated | prediction-registry-storage.test.ts | Verified |
| K-107 | Registry | Dataset split dates are validated | registry-107: Dataset split dates are validated | prediction-registry-storage.test.ts | Verified |
| K-108 | Registry | Model requires feature schema (via dataset check) | registry-108: Model requires feature schema (via dataset check) | prediction-registry-storage.test.ts | Verified |
| K-113 | Registry | Same model version with same metadata is idempotent | registry-113: Same model version with same metadata is idempotent | prediction-registry-storage.test.ts | Verified |
| K-114 | Registry | Same model version with changed metadata conflicts | registry-114: Same model version with changed metadata conflicts | prediction-registry-storage.test.ts | Verified |
| K-115 | Registry | Artifact metadata rejects embedded weights | registry-115: Artifact metadata rejects embedded weights | prediction-registry-storage.test.ts | Verified |
| K-116 | Registry | Artifact metadata rejects binary payloads | registry-116: Artifact metadata rejects binary payloads | prediction-registry-storage.test.ts | Verified |
| K-117 | Registry | Registry reads return validated domain-shaped values | registry-117: Registry reads return validated domain-shaped values | prediction-registry-storage.test.ts | Verified |
| L-119 | Error Mapping | conflict maps to PredictionStorageConflictError | error type mapping | prediction-storage.test.ts | Verified |
| L-120 | Error Mapping | reference maps to PredictionStorageReferenceError | error type mapping | prediction-storage.test.ts | Verified |
| L-122 | Error Mapping | invariant maps to PredictionStorageInvariantError | error type mapping | prediction-storage.test.ts | Verified |
| M-126 | Fake DB | Fake DB creates deep copies | fake db creates deep copies | prediction-storage.test.ts | Verified |
| M-127 | Fake DB | Fake DB transaction rollback | fake db transaction rollback | prediction-storage.test.ts | Verified |

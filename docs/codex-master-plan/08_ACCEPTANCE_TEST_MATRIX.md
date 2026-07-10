# 08 — Acceptance Test Matrix

## Global Gates

- TypeScript typecheck passes
- API tests pass
- worker tests pass
- web build passes
- Prisma validate/generate pass
- no unauthorized schema changes
- no raw provider payload in public output
- no credentials/secrets in logs/output
- no forbidden betting fields
- no unrelated files changed
- `git diff --check` has no actual whitespace errors

## Odds Engine

- input permutation invariance
- deterministic assessment ID
- complete market selection requirements
- exact implied/fair probability fixtures
- probabilities sum to one within fixed tolerance
- invalid/ambiguous lines rejected
- StablePrice treated as one provider
- temporal movement exact tests
- stale-gap behavior
- outlier behavior
- hard reliability gates
- model weight zero when unusable
- public map contains no internal scores/weights

## SSE

- chunk boundary parsing
- CRLF/LF
- comments
- heartbeat
- multiple data lines
- malformed JSON isolation
- message size cap
- abort
- retry field
- reconnect
- heartbeat timeout
- catch-up deduplication
- graceful shutdown

## Prediction Engine

- every distribution sums to one
- monotonic goal horizons
- deterministic output
- no future-data leakage
- no unavailable specialist weight
- market weight never exceeds recommended cap
- fallback paths
- score/minute edge cases
- halftime/fulltime
- red card/event shock
- stale odds excluded
- explanation allowlist
- confidence/risk bounded
- no forbidden fields

## Storage

- same ID/same hash idempotent
- same ID/different hash conflict
- transactional aggregates
- rollback on child failure
- corrupt stored payload raises invariant error
- stable list ordering
- bounded pagination
- immutable label progression

## Replay/Evaluation

- merged timeline stable ordering
- deterministic clock
- no future rows
- identical replay produces identical predictions
- prediction changes only on allowed trigger
- final labels correct
- metrics exact on fixtures
- calibration buckets deterministic
- oscillation/stability checks

## Public API

- exact top-level field allowlist
- recursive forbidden-key scan
- bounded arrays and text
- stale/degraded/no-data responses
- unknown fixture
- backward-compatible old routes
- no provider payload
- no model internals
- safe caching semantics

## Frontend

- live/upcoming/completed browser
- match detail renders no-data/partial/live/stale
- probability cards
- history chart
- market chart
- replay controls
- mobile
- loading/error/retry
- proof status semantics
- no protected branding
- no betting CTA

## Telegram

- webhook auth
- command parsing
- subscription add/remove
- alert thresholds
- deduplication
- retry log
- silent low-impact behavior
- text sanitation
- no betting language
- bounded message length

## Deployment

- clean environment install
- migrations on empty database
- migration on seeded database
- API readiness
- worker readiness
- graceful stop
- evaluator demo without secret entry
- rollback instructions

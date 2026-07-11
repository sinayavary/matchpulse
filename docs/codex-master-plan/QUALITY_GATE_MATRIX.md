# MatchPulse Competition Quality Gate Matrix

| Surface | Required evidence |
| --- | --- |
| Every change | exact allowlist, focused tests, package typecheck/build as applicable, `git diff --check`, secret scan, unchanged unrelated work |
| Deterministic logic | boundary tests, repeated-run equality, stable ordering, immutable inputs, bounded numeric invariants |
| TxLINE adapters | fixtures, schema/contract tests, timeout/retry/cancellation tests, redacted errors; live check optional with authorization and credentials |
| Streams | reconnect, heartbeat, catch-up, duplicate/gap/stale handling, monotonic checkpoint, graceful shutdown |
| PostgreSQL | isolated local PostgreSQL 16, explicit migration permission, migration validation, idempotency, constraints, restart/replay, rollback or forward-fix evidence |
| Prediction | no future leakage, normalized probabilities, fallback behavior, versioned features/models, replay and segmented evaluation |
| Public API | versioned schema, authentication/limits as applicable, degraded states, forbidden-field and secret-leakage tests |
| Web | Persian/English, RTL/LTR, responsive and accessible loading/no-data/stale/error states, no gambling language |
| Watchlist/Telegram | user control, dedupe/cooldown, sanitization, failure handling, local fake; live send optional |
| Docker/local release | reproducible build/start, health/readiness, environment template, isolated database, seeded end-to-end smoke test |
| Competition submission | CI green, release notes, limitations, startup instructions, immutable commit and artifact inventory |

No required gate may be waived by weakening assertions, increasing tolerances without specification, hiding failures, or substituting mock evidence for a claimed live check. No P0/P1 defect, critical/high unresolved security finding, secret exposure, data corruption risk or public-boundary leak may remain at release.

Solana/on-chain verification is deferred and absent from the completion gate.

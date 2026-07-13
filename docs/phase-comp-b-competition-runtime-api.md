# Phase COMP-B — Competition Prediction Runtime and Public-Safe API

## Delivered boundary

COMP-B connects the published `competition_baseline_v1` profile to existing stored MatchPulse state, event, and Odds Intelligence foundations through a bounded request-time service.

The runtime does not add a database table, migration, background worker, queue, continuous supervisor, external model, or provider dependency.

## Routes

### Internal

```http
GET /api/internal/competition/matches/:fixtureId/prediction
```

The internal route requires the existing MatchPulse internal token. It may return the complete validated `FinalPredictionSnapshot` plus the public-safe market-analysis object. It never returns raw observations, raw provider payloads, secrets, stack traces, or debug lineage.

### Public

```http
GET /api/public/v1/matches/:fixtureId/prediction
```

The public route returns:

- final outcome probabilities;
- next-goal probabilities;
- next 5/10/15 minute goal probabilities;
- bounded final-score distribution;
- current-result survival/change;
- momentum-shift probabilities;
- bounded confidence and safe reasons;
- bounded risk and safe reasons;
- public explanation and limitations;
- data quality and freshness;
- the mandatory, separately labeled `market_analysis` object;
- informational analytics safety notes.

No query parameters are accepted in COMP-B. Unknown parameters receive a sanitized `400` response.

## Runtime inputs

The stored request path reuses:

- `getDbBackedMatchState` for canonical fixture, score, phase, and freshness state;
- the persisted Odds Intelligence assessment through `prediction-storage`;
- `getDbBackedMatchEventContext` and `buildEventImpactAssessment`;
- the current `MatchState.minute` field through one bounded read;
- `buildCompetitionPredictionSnapshot` for the complete prediction output;
- `mapInternalOddsIntelligenceToPublic` for public market intelligence.

The request-time mapper derives only the bounded input required by `CompetitionPredictionInput`. It does not copy raw state, event descriptions, provider identity, or private odds details into the public contract.

## Replay fallback

The service supports an injected deterministic `CompetitionReplayInputProvider`. Replay inputs pass through the same competition model, public mapper, market-analysis mapper, validation, and leakage protection as stored inputs.

COMP-B does not embed demo fixtures into the pure prediction model. COMP-C may inject evaluator checkpoints without changing the model or public DTO.

## Degraded behavior

- Missing database configuration returns `no_data`, unless an injected replay input is available.
- Empty stored evidence returns `no_data`, unless replay is available.
- Storage failures are sanitized and may fall back to replay.
- `no_data` never fabricates a live prediction snapshot.
- Partial evidence returns a complete prediction only when COMP-A accepts the bounded input.
- Overall prediction freshness is the most conservative freshness of available score, event, and market evidence.
- Market freshness remains independently visible in `market_analysis`.
- Missing or unusable odds retain a mandatory unavailable/limited market-analysis object.
- Route failures never expose exception messages, paths, credentials, or raw payloads.

## Public safety

The public prediction mapper is allowlist-based. It reconstructs safe explanations from structured coverage and risk state instead of copying internal explanation text.

The public response recursively rejects protected keys, including:

- specialist contributions and assigned weights;
- feature references and hashes;
- Odds Intelligence assessment references;
- fair and consensus probabilities;
- provider/bookmaker identity;
- component scores, formulas, thresholds, and coefficients;
- raw observations, source payloads, debug data, and stack traces;
- betting, stake, payout, profit, expected-value, wallet, or secret fields.

Odds limitations are converted to fixed public categories before the existing public market mapper is called. Prediction and market analysis remain semantically separate.

## Validation requirements

Execution must prove:

- COMP-A profile and prediction engine tests remain passing;
- COMP-B focused service, mapper, contract, and route tests pass;
- internal authentication is enforced;
- all prediction families are present;
- `market_analysis` is mandatory for successful, no-data, and public error responses;
- stored, partial, stale, no-data, replay, finished, and sanitized-failure behavior passes;
- public recursive leakage tests pass;
- unknown query parameters are rejected;
- API typecheck and production build pass;
- full API regression passes;
- `git diff --check` passes;
- Prisma schema/migration diff is empty;
- no migration, database mutation, real network access, or successor activation occurs.

## Completion boundary

After all declared validation succeeds, update only permitted COMP-B completion metadata, run Automation v2 `Prepare`, and stop before `Publish`. COMP-C must not be activated in the same execution.

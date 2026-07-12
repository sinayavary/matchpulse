# Phase COMP-B v1 — Competition Prediction Runtime and Public-Safe API

## Review status

This is a review-only phase definition. It must not become active until `COMP-A` is completed, reviewed, and published.

- Track: Competition Release
- Pack version: `COMP-B-v1`
- Dependency: `COMP-A`
- Successor: `COMP-C`

## Objective

Connect `competition_baseline_v1` to the existing canonical state, odds reliability, event-intelligence, and public market-intelligence foundations and expose a bounded versioned competition prediction API.

This phase must make the complete competition prediction output and a mandatory user-facing odds analysis usable without waiting for the production streaming/persistence chain in `10G` and `10I`.

## Runtime boundary

Implement a request-time competition prediction service:

```text
fixture id
  ↓
existing DB-backed canonical state + odds reliability + event context
  ├─→ competition prediction input mapper
  │     ↓
  │   competition_baseline_v1
  │     ↓
  │   FinalPredictionSnapshot
  │     ↓
  │   competition public-safe prediction mapper
  │
  └─→ existing odds-intelligence public mapper
        ↓
      PublicMarketIntelligence

public prediction + mandatory market_analysis
  ↓
versioned route
```

The service may use bounded short-lived in-memory caching. It must not require a new table, migration, queue, continuous supervisor, or external ML service.

## Required routes

### Protected internal route

```http
GET /api/internal/competition/matches/:fixtureId/prediction
```

- requires existing internal-token authentication;
- may return the complete internal `FinalPredictionSnapshot` and internal odds-intelligence reference after internal safety validation;
- rejects unknown query parameters;
- never returns raw provider payloads or secrets.

### Versioned public-safe route

```http
GET /api/public/v1/matches/:fixtureId/prediction
```

The public route returns all user-facing prediction families plus a mandatory `market_analysis` object. It removes specialist contributions, feature references, odds component details, provider identities, exact internal weights, fair/consensus probabilities, formulas, and debug data.

## Public DTO

The public DTO must include:

- `fixture_id`;
- `as_of`;
- `model_profile: competition_baseline_v1`;
- final outcome probabilities;
- next goal probabilities;
- goal horizon probabilities;
- bounded final score distribution;
- current result survival;
- momentum shift;
- public confidence level and bounded score;
- public risk level and safe reasons;
- explanation summary, main factors, and limitations;
- data quality/freshness summary;
- mandatory `market_analysis`;
- informational analytics safety note.

### Mandatory `market_analysis`

`market_analysis` must reuse or remain schema-compatible with the existing `PublicMarketIntelligence` boundary and contain:

- availability;
- reliability;
- freshness;
- provider coverage category;
- provider agreement category;
- volatility category;
- market count;
- usable market count;
- provider count;
- up to three notable movements;
- for each movement: market label, selection label, direction, strength, and human-readable summary;
- overall market summary;
- public limitations;
- last update timestamp;
- public market safety note.

The API must keep prediction and odds analysis semantically separate. Market movement may explain a prediction factor, but the market analysis must not be presented as the final MatchPulse prediction.

It must not expose:

- `specialist_contributions`;
- `feature_reference`;
- `odds_intelligence_reference`;
- provider or bookmaker identities;
- internal coefficients, weights, caps, thresholds, or formulas;
- exact `fair_probability` or `consensus_probability` values;
- component scores or provider-quality scores;
- raw observations or provider payloads;
- betting, wagering, expected-value, stake, or profit fields.

## Degraded behavior

- Missing database configuration returns bounded `no_data` or replay fallback, never a fabricated live result.
- Partial inputs return a complete prediction with low confidence, elevated risk, and explicit limitations only when the COMP-A fallback contract allows it.
- Missing or unusable odds return a valid `market_analysis` with unavailable/limited status and human-readable limitations; the field must not disappear silently.
- Stale odds must be labeled stale or aging and must reduce model support according to COMP-A rules.
- A finished match returns terminal prediction semantics.
- Service errors return sanitized responses without stack traces or internal paths.

## Replay fallback

The service must support an injected deterministic replay input provider. This gives COMP-C a no-network evaluator path without coupling the pure prediction engine to demo fixtures.

The replay response must include deterministic public market analysis with at least one checkpoint that demonstrates a visible market movement and one checkpoint that demonstrates reliability/freshness degradation.

## Compatibility

- The public DTO becomes a backward-compatible minimum for future `10K`.
- `market_analysis` remains compatible with the existing public market-intelligence contract.
- Production `10I` may replace request-time generation with persisted snapshots without changing callers.
- Production `10H` may replace the model profile without changing the service or route contract.
- Existing public match endpoints remain backward compatible.

## Planned implementation targets

- `apps/api/src/competition-prediction-service.ts`
- `apps/api/src/competition-prediction-service.test.ts`
- `apps/api/src/competition-prediction-public-mapper.ts`
- `apps/api/src/competition-prediction-public-mapper.test.ts`
- `apps/api/src/competition-prediction-route-contract.ts`
- `apps/api/src/competition-prediction-route-contract.test.ts`
- `apps/api/src/server-competition-prediction-route.ts`
- `apps/api/src/server-competition-prediction-route.test.ts`
- `apps/api/src/server.ts`
- `apps/api/package.json`
- `docs/phase-comp-b-competition-runtime-api.md`

The phase should consume the existing odds-intelligence public mapper rather than duplicate market-analysis formulas or contracts.

## Validation gate

The activated pack must prove:

- all COMP-A focused tests remain passing;
- internal authentication is enforced;
- public mapper recursively blocks protected fields;
- public DTO contains every required prediction family;
- public DTO always contains a bounded `market_analysis` object;
- public odds analysis contains reliability, freshness, coverage, agreement, volatility, counts, movements, summary, limitations, and last update;
- exact fair/consensus probabilities, provider identities, component scores, and internal market weights never enter the public response;
- prediction and market analysis remain separately labeled;
- live/stored, partial, stale, no-data, finished, and replay cases pass;
- unknown query parameters are rejected;
- failures are sanitized;
- API typecheck and production build pass;
- full API regression passes;
- Prisma/migration diff is empty;
- no real network access occurs;
- only exact allowlisted files change.

## Completion

After successful execution:

1. update only allowed `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `PHASE_COMPLETE_PREPARED`;
5. do not activate `COMP-C` in the same execution.

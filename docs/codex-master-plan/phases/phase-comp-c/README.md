# Phase COMP-C v1 — Competition Web Experience, Replay Fallback, and Submission Gate

## Review status

This is a review-only phase definition. It must not become active until `COMP-B` is completed, reviewed, and published and the current frontend workspace collision state is re-verified.

- Track: Competition Release
- Pack version: `COMP-C-v1`
- Dependency: `COMP-B`
- Competition milestone: complete after this phase

## Objective

Deliver a bounded evaluator-ready MatchPulse experience that displays every competition prediction family and a mandatory human-readable odds analysis through the versioned public-safe API, works with current stored/live data when available, and has a deterministic replay fallback when live provider access is unavailable.

This phase is intentionally smaller than the future `10L` web experience. It must not introduce the final production browsing, history, notification, or verification scope.

## Required competition experience

The evaluator page must show:

- fixture identity and current score/phase/time when available;
- final outcome probabilities;
- next goal probabilities;
- goal probability for 5, 10, and 15 minutes;
- top final-score outcomes and remaining probability;
- current-result hold/change probability;
- momentum-shift probabilities;
- confidence and risk;
- concise explanation and limitations;
- data quality and freshness;
- model profile label indicating a competition baseline;
- a dedicated user-facing odds-analysis section;
- informational analytics safety note.

## Mandatory odds-analysis section

The odds-analysis section must be visually distinct from the MatchPulse prediction section and must show, in human-readable language:

- whether market data is available, limited, or unavailable;
- market reliability level;
- market freshness;
- provider coverage category;
- provider agreement category;
- volatility category;
- total market count, usable market count, and provider count;
- up to three notable movements;
- each movement's market, selection, direction, strength, and concise explanation;
- overall market summary;
- public limitations;
- last market update;
- market-intelligence safety note.

Example presentation language:

- "Market data is usable with good reliability."
- "Provider agreement is mixed."
- "Home market support moved upward with medium strength."
- "Market volatility is high, so this signal should be interpreted cautiously."

The UI must not call market movement a recommendation, guaranteed outcome, or final MatchPulse prediction.

## UX rules

- Never present the output as certain or guaranteed.
- Never use betting, wagering, stake, payout, profit, edge, or recommendation language.
- Clearly distinguish MatchPulse prediction from public market/odds analysis.
- Clearly distinguish live/stored data from deterministic replay data.
- Show stale, partial, and no-data states explicitly.
- The odds-analysis section must remain visible in limited/unavailable states and explain why data cannot be used.
- Mobile and desktop layouts must remain usable.
- No wallet, payment, or TxLINE credential is required from the evaluator.
- No internal provider, formula, threshold, weight, fair probability, consensus probability, component score, or debug data reaches browser props.

## Replay fallback

Provide at least one deterministic replay fixture that exercises:

- a non-terminal live match state;
- usable odds reliability;
- at least one event-impact or pressure signal;
- all prediction families;
- a public odds-analysis state with at least one notable movement;
- at least one checkpoint with changing market freshness, reliability, agreement, or volatility;
- low/medium/high confidence or risk behavior across replay checkpoints;
- terminal completion.

Replay assets must contain only approved normalized/synthetic or licensed fixture data. Raw protected provider payloads are forbidden.

## Competition mode selection

The web client may select:

- current public prediction API when available;
- replay prediction endpoint or bundled approved replay fixture when live data is unavailable.

Mode must be visible in the UI. Both modes must provide the same public prediction and `market_analysis` boundary.

## Submission gate

The phase must include:

- one evaluator entry URL;
- one no-wallet/no-payment path;
- one short technical architecture summary;
- one concise demo script;
- one configuration checklist;
- one final smoke command;
- explicit known limitations of `competition_baseline_v1`;
- explicit explanation of the difference between prediction output and odds analysis;
- proof that all public responses and browser props pass forbidden-field scans.

## Compatibility

- The page consumes the permanent versioned prediction DTO.
- The odds panel consumes the existing public market-intelligence-compatible `market_analysis` object.
- Future `10K` may add persistence/history without breaking it.
- Future `10L` may replace the competition presentation while preserving API compatibility.
- No competition component may import prediction engine or internal odds-engine internals directly.

## Planned implementation targets

Exact frontend targets must be generated only after collision verification. Expected scope:

- a versioned web API client method for competition predictions and market analysis;
- a competition prediction panel;
- a dedicated odds-analysis panel or a clearly separated section inside the competition panel;
- an evaluator/demo page or extension of the approved existing match detail page;
- focused component and API-client tests;
- approved deterministic replay fixture and adapter;
- competition submission documentation.

The activated manifest must list exact paths and must not use broad frontend allowlists.

## Validation gate

The activated pack must prove:

- every required prediction family is rendered;
- the mandatory odds-analysis section renders every public field;
- prediction and odds analysis are visually and semantically distinct;
- live/stored and replay modes both work;
- replay visibly demonstrates market movement and reliability/freshness change;
- loading, stale, partial, no-data, and error states render safely;
- unavailable odds analysis remains visible with an explanation;
- no protected field enters client props;
- no betting language exists;
- no wallet or payment is required;
- web typecheck/build and focused tests pass;
- API regression and production build remain passing;
- exact path scope is respected;
- unrelated local frontend work remains unchanged.

## Completion

After successful execution:

1. update only allowed `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `COMPETITION_RELEASE_PREPARED`;
5. do not activate `10H-A` in the same execution.

After human review and publication, the Competition Release Track is complete and the repository may resume the Future Production Track with a newly baselined `10H-A` pack.

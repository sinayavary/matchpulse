# MatchPulse Competition Release Submission

## Evaluator entry

- Web entry URL: `/competition`
- Live / stored mode: `/competition?mode=live&fixtureId=<PUBLIC_FIXTURE_ID>`
- Deterministic replay mode: `/competition?mode=replay&checkpoint=opening-balance`
- Additional replay checkpoints: `pressure-shift`, `terminal-home`

No wallet, payment, private credential, operator token, or TxLINE subscription action is required for the evaluator page.

## What the evaluator sees

The page renders the permanent versioned public-safe competition prediction response:

- final outcome probabilities;
- next-goal probabilities;
- goal probability over 5, 10, and 15 minute horizons;
- leading final-score scenarios and remaining probability;
- current-result hold/change probability;
- momentum-shift probabilities;
- confidence and risk;
- concise explanation and limitations;
- data quality, coverage, and freshness;
- the `competition_baseline_v1` model-profile label.

A visually separate market / odds analysis section renders:

- availability;
- reliability;
- freshness;
- provider-coverage category;
- provider-agreement category;
- volatility;
- market, usable-market, and provider counts;
- up to three notable public movements;
- summary;
- limitations;
- last update;
- the public market-intelligence safety note.

The market section describes public-safe data quality and movement. It is not merged into the MatchPulse prediction and does not provide prescriptive actions.

## Architecture summary

1. `apps/api/src/competition-replay-fixtures.ts` builds deterministic synthetic replay checkpoints through the existing competition model profile and existing public-safe mapper.
2. `registerCompetitionPredictionRoutes` exposes a replay index and replay checkpoint endpoint under `/api/public/v1/competition/replay`.
3. Live / stored mode continues to consume `/api/public/v1/matches/:fixtureId/prediction`.
4. `apps/web/lib/competition-api.ts` is the only web transport boundary for these routes.
5. `CompetitionPredictionPanel` receives only the public-safe DTO and renders prediction and market analysis as separate sections.
6. The replay fixture remains backend-owned. Internal feature references, assessment identifiers, provider internals, formulas, weights, thresholds, raw observations, secrets, and proof blobs never enter browser props.

## Deterministic replay script

1. Open `/competition?mode=replay&checkpoint=opening-balance`.
2. Confirm the match is 0-0 in the first half with fresh, strong, low-volatility market evidence.
3. Select **Pressure shift**.
4. Confirm the match is 1-1 in the second half and that market freshness changes to aging, agreement becomes mixed, volatility becomes high, and away next-goal support moves upward.
5. Select **Terminal home result**.
6. Confirm the match is finished 2-1, final-outcome probability is terminal, no-further-goal probability is terminal, and stale market evidence remains visible but unusable.
7. Confirm every checkpoint keeps the prediction and market sections visually and semantically distinct.
8. Confirm no internal/provider fields appear in the page or network response.

## Live / stored script

1. Open `/competition`.
2. Enter a public fixture ID and select **Load live / stored view**.
3. When the public prediction endpoint returns usable data, confirm the page shows mode `live / stored public API`.
4. When the live / stored response is unavailable or contains no prediction, confirm the page explicitly announces replay fallback and shows the selected approved replay checkpoint.

## Configuration checklist

- `NEXT_PUBLIC_API_BASE_URL` points to the MatchPulse API origin when web and API are on different origins.
- The API has the existing public competition prediction route registered.
- No internal token is supplied to the browser.
- No database migration is required.
- No runtime provider/network access is required for deterministic replay.
- CORS permits the evaluator web origin when required.

## Validation and smoke commands

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/competition-model-profile.test.ts src/prediction-engine-v1.test.ts src/odds-intelligence-public-mapper.test.ts src/competition-prediction-public-mapper.test.ts src/server-competition-prediction-route.test.ts src/competition-replay-fixtures.test.ts src/server-competition-replay-route.test.ts ../web/lib/competition-api.test.ts ../web/components/competition/CompetitionPredictionPanel.test.tsx
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api build
pnpm.cmd --filter @matchpulse/api test
pnpm.cmd --filter @matchpulse/web typecheck
pnpm.cmd --filter @matchpulse/web build
git diff --check
git diff --name-only -- prisma
```

Local smoke after builds, using deterministic data only:

```powershell
pnpm.cmd --filter @matchpulse/api start
pnpm.cmd --filter @matchpulse/web start
```

Then open `/competition?mode=replay&checkpoint=opening-balance`. Starting runtime processes is discretionary and must not be used to claim real live-provider verification.

## Public-safety proof

Focused API tests assert that replay responses exclude protected nested keys and private replay assessment identifiers. Focused web tests assert that every required section renders, that prediction and market analysis are distinct, that fallback/no-data states remain explicit, and that protected fields or prescriptive product terms are absent from rendered output.

## Known limitations

- `competition_baseline_v1` is intentionally bounded and is not production calibrated.
- Deterministic replay uses approved synthetic fixture data and does not demonstrate real provider availability.
- Live / stored mode depends on previously persisted canonical MatchPulse data.
- The competition page is an evaluator release surface, not the future full browsing, history, notification, or verification product.
- Derived prediction output is not cryptographically verified merely because an input may have proof metadata.

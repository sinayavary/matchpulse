# Phase COMP-C v2 — Competition Release Experience and Deterministic Replay

## Status and authority

This is an **inactive review-only implementation pack**. Installing this directory does not activate or execute `COMP-C`.

- Phase: `COMP-C`
- Pack version: `COMP-C-v2`
- Exact implementation baseline: `a3641a092a91e934bf5e3cf7d0b32bf3bc8109a0`
- Dependency completion: published `COMP-B-v2`
- Migration allowed: no
- Real application network access allowed during validation: no
- Queue transition included: no
- Successor activation included: no

Activation requires a separate human-reviewed governance change after this pack is installed and reviewed. During installation, do not modify `ACTIVE_PHASE.json` or `PHASE_QUEUE.json`.

## Why v2 replaces the old review specification

`COMP-C-v1` was created before `COMP-A` and `COMP-B` completed. It was review-only, had an obsolete baseline, lacked `EXPECTED_SHA256.json`, and contained no executable payload. Its two shared API targets later changed during the competition runtime phases.

`COMP-C-v2` is rebaselined on the published `COMP-B-v2` completion commit and avoids broad or historically collision-prone frontend files. It does not modify:

- `apps/api/src/server.ts`
- `apps/web/lib/public-api.ts`
- `apps/web/components/matches/MatchDetailView.tsx`
- `apps/web/tsconfig.json`
- `apps/web/next-env.d.ts`
- `pnpm-workspace.yaml`
- Prisma or migrations

## Objective

Deliver an evaluator-ready public-safe competition experience that:

1. displays all permanent competition prediction families;
2. displays mandatory human-readable public market analysis as a separate section;
3. uses the existing live/stored public competition prediction endpoint when data is available;
4. provides deterministic synthetic replay fallback when live/stored data is unavailable;
5. demonstrates changing market quality and a terminal match state;
6. requires no wallet, payment, private token, provider credential, or database migration.

This phase remains smaller than the future full production browsing, history, notification, and verification experience.

## Exact payload

Apply exactly one canonical-LF patch stored as deterministic gzip/base64 text:

`payload/patches/01-comp-c-v2.patch.gz.b64`

Canonical-LF payload-file SHA-256:

`688927f3b384936795b0be6b2a46f2220a2fc9e32597b543910de56495753d0a`

Decoded gzip SHA-256:

`cf881f73ff6097024623f9d016ec455faadecf033f3ba4a3cf7076efba9e7aba`

Decoded canonical patch SHA-256:

`f746fe54d34d868da9498871c7b1b71eb10326bfd89aed191677934f9237412f`

The gzip stream uses a zero timestamp, so the encoded payload is reproducible.

Before applying, verify:

- `apps/api/package.json` blob is `ebc1d59f9f5b49b7e4dd2215e1289099ea02411c` at the baseline;
- `apps/api/src/server-competition-prediction-route.ts` blob is `9e652b01470854f5ed6ee128a02d35d4e85b0fec` at the baseline;
- every path listed in `baseline_absent_targets` is absent;
- all allowed targets are clean;
- no allowed target changed after the pack baseline.

Apply only after Automation v2 Validate succeeds:

```powershell
$encoded = "docs/codex-master-plan/phases/phase-comp-c-v2/payload/patches/01-comp-c-v2.patch.gz.b64"
$tempGzip = Join-Path $env:TEMP "matchpulse-comp-c-v2.patch.gz"
$tempPatch = Join-Path $env:TEMP "matchpulse-comp-c-v2.patch"
$base64 = (Get-Content -LiteralPath $encoded -Raw) -replace "\s", ""
[IO.File]::WriteAllBytes($tempGzip, [Convert]::FromBase64String($base64))
$input = [IO.File]::OpenRead($tempGzip)
$output = [IO.File]::Create($tempPatch)
try {
  $gzip = [IO.Compression.GzipStream]::new($input, [IO.Compression.CompressionMode]::Decompress)
  try { $gzip.CopyTo($output) } finally { $gzip.Dispose() }
} finally {
  $output.Dispose()
  $input.Dispose()
}
if ((Get-FileHash $tempGzip -Algorithm SHA256).Hash.ToLowerInvariant() -ne "cf881f73ff6097024623f9d016ec455faadecf033f3ba4a3cf7076efba9e7aba") { throw "gzip hash mismatch" }
if ((Get-FileHash $tempPatch -Algorithm SHA256).Hash.ToLowerInvariant() -ne "f746fe54d34d868da9498871c7b1b71eb10326bfd89aed191677934f9237412f") { throw "decoded patch hash mismatch" }
git apply --check --whitespace=error-all -- $tempPatch
git apply --whitespace=error-all -- $tempPatch
Remove-Item $tempGzip,$tempPatch -Force
```

Do not hand-recreate, reorder, partially apply, recompress, or silently edit payload content.

## Exact implementation targets

1. `apps/api/package.json`
2. `apps/api/src/competition-replay-fixtures.test.ts`
3. `apps/api/src/competition-replay-fixtures.ts`
4. `apps/api/src/server-competition-prediction-route.ts`
5. `apps/api/src/server-competition-replay-route.test.ts`
6. `apps/web/app/competition/page.tsx`
7. `apps/web/components/competition/CompetitionPredictionPanel.test.tsx`
8. `apps/web/components/competition/CompetitionPredictionPanel.tsx`
9. `apps/web/lib/competition-api.test.ts`
10. `apps/web/lib/competition-api.ts`
11. `docs/competition-release-submission.md`

No other implementation file is authorized.

## Backend replay contract

The replay fixture is deterministic, synthetic, server-owned, and mapped through the existing `competition-public-prediction-v1` boundary. It must never expose internal input fields.

Public routes:

- `GET /api/public/v1/competition/replay`
- `GET /api/public/v1/competition/replay/:checkpointId`

Published checkpoint IDs:

- `opening-balance`
- `pressure-shift`
- `terminal-home`

The detail route returns the same top-level public prediction and `market_analysis` separation used by the live/stored route. Missing checkpoints and invalid query parameters return sanitized bounded responses without echoing user-supplied private-looking text.

Replay behavior must show:

- first-half 0-0 opening state with fresh, strong, low-volatility market evidence;
- second-half 1-1 pressure shift with aging, limited, mixed, high-volatility market evidence;
- finished 2-1 terminal state with terminal prediction probabilities and stale market evidence that remains visible but unusable.

## Web contract

Evaluator entry URL:

`/competition`

Modes:

- live/stored: `/competition?mode=live&fixtureId=<PUBLIC_FIXTURE_ID>`
- replay: `/competition?mode=replay&checkpoint=<CHECKPOINT_ID>`

The page must render:

- fixture, score, phase, and minute;
- final outcome;
- next goal;
- 5/10/15 minute goal horizons;
- final-score scenarios;
- current-result survival;
- momentum shift;
- confidence and risk;
- explanation and limitations;
- data quality and freshness;
- model profile;
- a visually separate market / odds analysis section;
- replay/live mode labels and explicit fallback state;
- prediction and market safety notes.

The market section must show every public field declared by the manifest expected results. Unavailable market analysis remains visible and explained.

## Public-safety boundary

The browser receives only public DTO fields. The implementation must not add or render:

- raw provider observations or payloads;
- provider names or identities;
- assessment IDs;
- feature references or hashes;
- specialist contributions;
- fair or consensus probabilities;
- internal component scores;
- formulas, thresholds, coefficients, or model weights;
- credentials, tokens, secrets, internal errors, or proof blobs;
- prescriptive wagering, stake, payout, profit, expected-value, wallet, payment, or financial recommendation features.

Safety disclaimers may identify prohibited use in order to state that MatchPulse does not provide it; they must not become promotional or prescriptive product language.

## Required validation

Run every command exactly as listed in `manifest.json`:

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

The final Prisma command must produce no paths. Do not run migration commands, real-provider smoke tests, or paid/production network operations.

## Successful completion

Only after every required validation passes:

1. update only the permitted successful-completion fields in `ACTIVE_PHASE.json`;
2. keep phase identity and baseline unchanged;
3. set `state` to `completed_pending_review`;
4. set `human_approved` to `false`;
5. record the exact changed allowed targets in `last_result.files_changed`;
6. record actual validation, migration, and network facts;
7. run Automation v2 `Prepare`;
8. stop before Publish;
9. report `COMPETITION_RELEASE_PREPARED` and final status `PHASE_COMPLETE_PREPARED`;
10. do not modify `PHASE_QUEUE.json` and do not activate `10H-A` or any successor.

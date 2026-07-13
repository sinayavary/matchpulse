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

Activation requires a separate human-reviewed governance change after installation and review. Pack installation must not modify `ACTIVE_PHASE.json` or `PHASE_QUEUE.json`.

## Why v2 replaces the old review specification

`COMP-C-v1` preceded completion of `COMP-A` and `COMP-B`. It was review-only, used an obsolete baseline, had no exact payload, and had no integrity file. Its shared API targets later changed.

`COMP-C-v2` is rebaselined on the published `COMP-B-v2` completion commit and avoids broad or historically collision-prone files. It does not modify:

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
3. uses the existing live/stored public competition prediction endpoint when available;
4. provides deterministic synthetic replay fallback when live/stored data is unavailable;
5. demonstrates changing market quality and a terminal match state;
6. requires no wallet, payment, private token, provider credential, or migration.

This remains smaller than the future full production browsing, history, notification, and verification experience.

## Exact payload

The exact canonical patch is stored as a deterministic gzip/base64 stream split into five lexicographically ordered chunks:

- `payload/chunks/part-00.b64.part`
- `payload/chunks/part-01.b64.part`
- `payload/chunks/part-02.b64.part`
- `payload/chunks/part-03.b64.part`
- `payload/chunks/part-04.b64.part`

Integrity identities:

- ordered canonical-LF chunk concatenation SHA-256: `688927f3b384936795b0be6b2a46f2220a2fc9e32597b543910de56495753d0a`
- decoded gzip SHA-256: `cf881f73ff6097024623f9d016ec455faadecf033f3ba4a3cf7076efba9e7aba`
- decoded canonical patch SHA-256: `f746fe54d34d868da9498871c7b1b71eb10326bfd89aed191677934f9237412f`

The gzip stream uses a zero timestamp and is reproducible. Individual chunk hashes are authoritative in `EXPECTED_SHA256.json`.

Before applying, verify:

- `apps/api/package.json` baseline blob: `ebc1d59f9f5b49b7e4dd2215e1289099ea02411c`;
- `apps/api/src/server-competition-prediction-route.ts` baseline blob: `9e652b01470854f5ed6ee128a02d35d4e85b0fec`;
- every `baseline_absent_targets` path is absent;
- every allowed target is clean;
- no allowed target changed after the baseline;
- Automation v2 Validate passed.

### Canonical verification and application

```powershell
$pack = "docs/codex-master-plan/phases/phase-comp-c-v2"
$expected = Get-Content (Join-Path $pack "EXPECTED_SHA256.json") -Raw | ConvertFrom-Json
$chunks = @(Get-ChildItem (Join-Path $pack "payload/chunks") -File | Sort-Object Name)
if ($chunks.Count -ne 5) { throw "Expected exactly five payload chunks." }

function Get-CanonicalLfBytes([string]$Path) {
  $strict = [Text.UTF8Encoding]::new($false, $true)
  $text = $strict.GetString([IO.File]::ReadAllBytes((Resolve-Path $Path).Path))
  [Text.UTF8Encoding]::new($false).GetBytes($text.Replace("`r`n", "`n").Replace("`r", "`n"))
}
function Get-Sha256Hex([byte[]]$Bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { (($sha.ComputeHash($Bytes) | ForEach-Object { $_.ToString("x2") }) -join "") }
  finally { $sha.Dispose() }
}

$combined = [Collections.Generic.List[byte]]::new()
foreach ($chunk in $chunks) {
  $relative = "payload/chunks/$($chunk.Name)"
  $bytes = Get-CanonicalLfBytes $chunk.FullName
  $actual = Get-Sha256Hex $bytes
  $wanted = [string]$expected.files.PSObject.Properties[$relative].Value
  if ($actual -ne $wanted) { throw "Chunk hash mismatch: $relative" }
  $combined.AddRange($bytes)
}
if ((Get-Sha256Hex $combined.ToArray()) -ne [string]$expected.ordered_combined_sha256) {
  throw "Ordered payload hash mismatch."
}

$base64Text = [Text.UTF8Encoding]::new($false).GetString($combined.ToArray()) -replace "\s", ""
$tempGzip = Join-Path $env:TEMP "matchpulse-comp-c-v2.patch.gz"
$tempPatch = Join-Path $env:TEMP "matchpulse-comp-c-v2.patch"
[IO.File]::WriteAllBytes($tempGzip, [Convert]::FromBase64String($base64Text))
if ((Get-FileHash $tempGzip -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$expected.decoded_gzip_sha256) {
  throw "Decoded gzip hash mismatch."
}

$input = [IO.File]::OpenRead($tempGzip)
$output = [IO.File]::Create($tempPatch)
try {
  $gzip = [IO.Compression.GzipStream]::new($input, [IO.Compression.CompressionMode]::Decompress)
  try { $gzip.CopyTo($output) } finally { $gzip.Dispose() }
} finally {
  $output.Dispose()
  $input.Dispose()
}
if ((Get-FileHash $tempPatch -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$expected.decoded_patch_sha256) {
  throw "Decoded patch hash mismatch."
}

git apply --check --whitespace=error-all -- $tempPatch
if ($LASTEXITCODE -ne 0) { throw "git apply --check failed." }
git apply --whitespace=error-all -- $tempPatch
if ($LASTEXITCODE -ne 0) { throw "git apply failed." }
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

Replay data is deterministic, synthetic, server-owned, and mapped through the existing `competition-public-prediction-v1` boundary. Internal input fields must never appear publicly.

Public routes:

- `GET /api/public/v1/competition/replay`
- `GET /api/public/v1/competition/replay/:checkpointId`

Published checkpoint IDs:

- `opening-balance`
- `pressure-shift`
- `terminal-home`

The detail route preserves the same top-level separation between prediction data and `market_analysis` used by live/stored responses. Missing checkpoints and invalid query parameters return sanitized bounded responses without echoing user input.

Replay behavior:

- first-half 0-0 opening state with fresh, strong, low-volatility market evidence;
- second-half 1-1 pressure shift with aging, limited, mixed, high-volatility market evidence;
- finished 2-1 terminal state with terminal probabilities and stale market evidence that remains visible but unusable.

## Web contract

Evaluator entry URL: `/competition`

Modes:

- live/stored: `/competition?mode=live&fixtureId=<PUBLIC_FIXTURE_ID>`
- replay: `/competition?mode=replay&checkpoint=<CHECKPOINT_ID>`

The page must render fixture identity, score/phase/minute, every required prediction family, confidence, risk, explanation, limitations, data quality, freshness, model profile, mode/fallback status, and prediction safety note.

A visually and semantically separate market section must show availability, reliability, freshness, coverage, agreement, volatility, counts, notable movements, summary, limitations, last update, and market safety note. Unavailable market analysis remains visible and explained.

## Public-safety boundary

Browser props and public responses must not include raw provider data, provider identity, assessment IDs, feature references, specialist contributions, fair/consensus probabilities, internal scores, formulas, thresholds, coefficients, weights, credentials, tokens, secrets, internal errors, proof blobs, or prescriptive wagering/financial features.

Safety disclaimers may identify prohibited use only to state that MatchPulse does not provide it; they must not become promotional or prescriptive language.

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

The Prisma command must produce no paths. Do not run migrations, real-provider smoke tests, or production/paid network operations.

## Successful completion

Only after every validation passes:

1. update only permitted completion fields in `ACTIVE_PHASE.json`;
2. keep phase identity and baseline unchanged;
3. set `state=completed_pending_review` and `human_approved=false`;
4. record exact changed allowed targets and actual validation/migration/network facts;
5. run Automation v2 Prepare;
6. stop before Publish;
7. report `COMPETITION_RELEASE_PREPARED` and `PHASE_COMPLETE_PREPARED`;
8. do not modify `PHASE_QUEUE.json` or activate `10H-A` or any successor.

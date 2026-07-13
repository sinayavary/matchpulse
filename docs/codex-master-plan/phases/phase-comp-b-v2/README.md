# Phase COMP-B v2 — Exact Competition Runtime and Public-Safe API Pack

## Review status

This is an **inactive, review-only exact implementation pack**. It supersedes the preliminary `COMP-B-v1` definition only after this pack is reviewed and installed on `main`.

It must not be activated or executed until a separate governance change records explicit human approval for `COMP-B-v2`.

- Track: Competition Release
- Phase: `COMP-B`
- Pack version: `COMP-B-v2`
- Baseline: `0df8ff23e23501c4b67108821d331f937d74887d`
- Predecessor: published `COMP-A`
- Successor: `COMP-C`
- Scope: locked; no Future Production Track work

## Objective

Expose the complete `competition_baseline_v1` output through a bounded request-time service and two versioned routes:

```http
GET /api/internal/competition/matches/:fixtureId/prediction
GET /api/public/v1/matches/:fixtureId/prediction
```

The public response always contains a separately labeled, public-safe `market_analysis`. It describes data availability, reliability, freshness, coverage, agreement, volatility, notable movement, summary, limitations, and last update. It is not presented as the MatchPulse prediction and contains no betting recommendation or financial instruction.

## Runtime design

The exact payload:

1. reads canonical stored match state through the existing match-state builder;
2. reads the latest persisted Odds Intelligence assessment through the existing prediction storage boundary;
3. reads stored event context and builds the existing event-impact assessment;
4. maps those existing foundations into `CompetitionPredictionInput`;
5. executes `competition_baseline_v1` at request time;
6. maps the internal snapshot into an explicit allowlisted public DTO;
7. maps sanitized odds intelligence through the existing public market-intelligence mapper;
8. supports an injected deterministic replay provider for evaluator availability.

No new table, migration, queue, worker, supervisor, external model, provider dependency, or prediction persistence is introduced.

## Exact payload

Apply the ordered patch set under:

```text
payload/patches/01-apps-api-package.patch
...
payload/patches/12-runtime-odds-freshness.patch
```

The lexicographic order is mandatory. Concatenating the twelve canonical-LF patch files in that order reproduces the reviewed combined payload hash recorded in `EXPECTED_SHA256.json`.

The ordered twelve-patch set changes exactly these eleven targets:

1. `apps/api/package.json`
2. `apps/api/src/competition-prediction-public-mapper.test.ts`
3. `apps/api/src/competition-prediction-public-mapper.ts`
4. `apps/api/src/competition-prediction-route-contract.test.ts`
5. `apps/api/src/competition-prediction-route-contract.ts`
6. `apps/api/src/competition-prediction-service.test.ts`
7. `apps/api/src/competition-prediction-service.ts`
8. `apps/api/src/server-competition-prediction-route.test.ts`
9. `apps/api/src/server-competition-prediction-route.ts`
10. `apps/api/src/server.ts`
11. `docs/phase-comp-b-competition-runtime-api.md`

No other target is permitted.

## Baseline lock

Before applying the patch, verify:

```text
HEAD = 0df8ff23e23501c4b67108821d331f937d74887d
apps/api/package.json blob = 70240d9b992d37ffe7584d37053af7b6a01a2a4d
apps/api/src/server.ts blob = fac7bcf57b5b851927011683e94aed0584432d6b
```

All newly introduced implementation and test files, plus the phase document, must be absent at the baseline. A mismatch is `SPEC_CONFLICT`; do not repair or regenerate the payload ad hoc.

## Canonical payload verification

Verify every file under `payload/patches` against `EXPECTED_SHA256.json` using strict UTF-8 and canonical LF normalization. Then concatenate the canonical bytes in lexicographic filename order and verify `ordered_combined_sha256`. Verification must not rewrite any payload file.

PowerShell verifier:

```powershell
function Get-CanonicalLfSha256 {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)

  $resolved = (Resolve-Path -LiteralPath $LiteralPath).Path
  $bytes = [System.IO.File]::ReadAllBytes($resolved)
  $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
  $text = $strictUtf8.GetString($bytes)
  $canonicalText = $text.Replace("`r`n", "`n").Replace("`r", "`n")
  $canonicalBytes = [System.Text.UTF8Encoding]::new($false).GetBytes($canonicalText)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($sha256.ComputeHash($canonicalBytes) | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $sha256.Dispose()
  }
}
```

## Exact application

After all baseline and integrity checks pass, materialize one canonical temporary patch from the ordered set and apply that single combined file:

```powershell
$patches = Get-ChildItem -LiteralPath docs/codex-master-plan/phases/phase-comp-b-v2/payload/patches -Filter *.patch | Sort-Object Name
if ($patches.Count -ne 12) { throw "SPEC_CONFLICT: expected exactly 12 ordered patches." }

$strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$combinedText = [System.Text.StringBuilder]::new()
foreach ($patch in $patches) {
  $text = $strictUtf8.GetString([System.IO.File]::ReadAllBytes($patch.FullName))
  [void]$combinedText.Append($text.Replace("`r`n", "`n").Replace("`r", "`n"))
}

$combinedPatch = Join-Path ([System.IO.Path]::GetTempPath()) "matchpulse-comp-b-v2-$PID.patch"
[System.IO.File]::WriteAllText($combinedPatch, $combinedText.ToString(), $utf8NoBom)
try {
  git apply --check --whitespace=error-all -- $combinedPatch
  if ($LASTEXITCODE -ne 0) { throw "SPEC_CONFLICT: COMP-B-v2 patch check failed." }

  git apply --whitespace=error-all -- $combinedPatch
  if ($LASTEXITCODE -ne 0) { throw "SPEC_CONFLICT: COMP-B-v2 patch application failed." }
} finally {
  Remove-Item -LiteralPath $combinedPatch -Force -ErrorAction SilentlyContinue
}
```

Then verify that `git status --short` resolves to only the eleven allowlisted targets before validation.

## Public safety boundary

The public prediction mapper is an allowlist, not a copy-and-delete mapper. Public output must never include:

- `specialist_contributions`;
- `feature_reference`, feature hashes, or private lineage;
- `odds_intelligence_reference` or assessment IDs;
- exact model weights, caps, coefficients, thresholds, or formulas;
- fair or consensus probabilities;
- provider or bookmaker identity;
- component/provider-quality scores;
- raw observations, payloads, debug data, stack traces, or internal paths;
- caller-controlled internal limitation strings;
- betting, wagering, stake, payout, profit, expected-value, or wallet fields.

Prediction and `market_analysis` remain semantically separate in every public response, including bounded `no_data` and sanitized error responses.

## Degraded and replay behavior

- Missing database configuration returns bounded `no_data`, unless an injected replay entry exists.
- Empty stored evidence returns bounded `no_data` or deterministic replay; it never fabricates a live snapshot.
- Stored-data failure may fall back to injected replay without exposing the underlying error.
- Missing or unusable odds preserve mandatory unavailable/limited `market_analysis`.
- Prediction freshness uses the least-fresh available supporting evidence; fresh odds cannot hide stale state or event data.
- Stored odds freshness is recalculated against request time; stale or unverifiable market evidence receives zero model weight.
- Finished matches retain terminal prediction semantics.
- Both routes reject every query parameter.
- Internal authentication reuses the existing constant-time token verifier.

## Validation gate

Run exactly the commands in `manifest.json`. Completion requires evidence that:

- all COMP-A prediction tests remain passing;
- the four new focused test files pass;
- every required prediction family is present;
- `market_analysis` exists in every public response;
- internal authentication is enforced;
- recursive public leakage scans pass;
- stored, partial, stale, no-data, finished, replay, and sanitized-failure paths pass;
- unknown query parameters are rejected;
- API typecheck, production build, and full API regression pass;
- `git diff --check` passes;
- Prisma/migration diff is empty;
- no real network or database mutation occurs;
- only exact allowlisted targets change.

## Authoring evidence

Before publication of this review pack:

- isolated strict TypeScript compilation passed for all eight new source/test files;
- an injected mock-runtime harness passed `23/23` focused tests;
- the ordered twelve-patch canonical concatenation and application check passed;
- the ordered patch set contains exactly eleven implementation targets;
- `git diff --check` passed after application.

This supporting evidence does **not** replace repository `pnpm` typecheck, build, or full regression. Those remain mandatory during a separately approved execution.

## Completion boundary

After an authorized execution passes every gate:

1. update only permitted `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `PHASE_COMPLETE_PREPARED`;
5. do not activate or execute `COMP-C` in the same run.

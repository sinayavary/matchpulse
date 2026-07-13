# Phase COMP-QA v1 — Competition Release Final QA and Acceptance

## Status and authority

This is an inactive review-only phase pack. Installing this directory does not activate or execute `COMP-QA`.

- Phase: `COMP-QA`
- Pack version: `COMP-QA-v1`
- Exact baseline: `46277a859bf39d11bb027060b1effaf823ec3acc`
- Dependency completion: published `COMP-C-v2`
- Migration allowed: no
- External service access allowed: no
- Queue transition included: no
- Successor activation included: no

Activation requires a separate governance change. Pack installation must not modify `ACTIVE_PHASE.json` or `PHASE_QUEUE.json`.

## Objective

Close the competition release track with a repository-controlled final QA gate that:

1. revalidates the evaluator surface and deterministic replay contract;
2. re-runs focused competition tests, both production builds, API regression, diff, and Prisma gates;
3. records a final release acceptance artifact;
4. handles Next-generated configuration side effects without committing them;
5. preserves public-safe boundaries and leaves `10H-A` inactive.

## Exact payload

The exact canonical patch is stored as one deterministic gzip/base64 chunk:

- `payload/chunks/part-00.b64.part`

Integrity identities:

- ordered canonical-LF chunk SHA-256: `3a18355f4cd2cd606d2aef946ece1f1ec2f32a4fe67cf0b610084cd54fcd778d`
- decoded gzip SHA-256: `9f0e8a53f7d7b09f57de0442d11b9cab516125938730a87b12219fbb2f097bea`
- decoded canonical patch SHA-256: `59048a3323fa32dddb929ff099604a7231a60f6aa49eb0f25942526a3851dd67`

Before applying, verify:

- the baseline commit is an ancestor of `HEAD`;
- `docs/competition-release-final-qa.md` is absent;
- `apps/web/next-env.d.ts` blob is `6080addc2d9595896fa4440b16cf51a41bfcfef8`;
- `apps/web/tsconfig.json` blob is `338677b11d0774eee857dbdfe427f97b81bbd5b2`;
- all allowed targets are clean;
- no allowed target changed after the baseline;
- Automation v2 Validate passed.

### Canonical verification and application

```powershell
$pack = "docs/codex-master-plan/phases/phase-comp-qa-v1"
$expected = Get-Content (Join-Path $pack "EXPECTED_SHA256.json") -Raw | ConvertFrom-Json
$chunks = @(Get-ChildItem (Join-Path $pack "payload/chunks") -File | Sort-Object Name)
if ($chunks.Count -ne 1) { throw "Expected exactly one payload chunk." }

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
$tempGzip = Join-Path $env:TEMP "matchpulse-comp-qa-v1.patch.gz"
$tempPatch = Join-Path $env:TEMP "matchpulse-comp-qa-v1.patch"
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

Do not hand-recreate, reorder, partially apply, recompress, or silently edit the payload.

## Exact allowed targets

1. `apps/web/next-env.d.ts`
2. `apps/web/tsconfig.json`
3. `docs/competition-release-final-qa.md`

The payload changes only `docs/competition-release-final-qa.md`.

The two web configuration files are allowlisted only because `next build` may rewrite them. They must be restored exactly from `HEAD` after the successful web build, verified clean, excluded from completion metadata, and excluded from the phase commit. No intentional content change to either file is authorized.

## Required validation

Run every command in `manifest.json` in order. After the successful web production build, run the exact path-scoped restore command from the manifest, then require the exact `git diff --quiet` command to pass.

The focused suite must cover the competition model, prediction engine, public mappers, live/stored public route, deterministic replay fixtures, replay route, web transport boundary, and evaluator component.

The API regression command must pass completely. Both API and web typecheck/build commands must pass. `git diff --check` must pass and the Prisma command must produce no paths.

Do not run a runtime server smoke, migration, database operation, external request, provider request, production request, paid-service call, deployment, or credentialed operation.

## Successful completion

Only after every validation passes:

1. update only permitted completion fields in `ACTIVE_PHASE.json`;
2. retain `COMP-QA / COMP-QA-v1` identity and baseline;
3. set `state=completed_pending_review` and `human_approved=false`;
4. record only the actual changed target `docs/competition-release-final-qa.md` in `last_result.files_changed`;
5. record accurate validation, migration, and network facts;
6. keep `PHASE_QUEUE.json` unchanged;
7. run Automation v2 Prepare;
8. stop before Publish;
9. report `COMPETITION_RELEASE_FINAL_QA_PREPARED` and `PHASE_COMPLETE_PREPARED`;
10. do not activate or execute `10H-A` or any successor.

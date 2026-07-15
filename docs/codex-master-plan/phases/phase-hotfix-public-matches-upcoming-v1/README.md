# Phase HOTFIX-PUBLIC-MATCHES-UPCOMING v1 — Public Matches Range Query Hotfix

## Status and authority

This is the exact repository-controlled implementation pack for `HOTFIX-PUBLIC-MATCHES-UPCOMING`.

- Phase: `HOTFIX-PUBLIC-MATCHES-UPCOMING`
- Pack version: `HOTFIX-PUBLIC-MATCHES-UPCOMING-v1`
- Exact baseline: `f6eca5347f9522d14c75321f29bc0d1700160afe`
- Dependency completion: published `COMP-QA-v1`
- Migration allowed: no
- External service access allowed: no
- Database mutation during validation: no
- Deployment or production operation: no

This pack is executable only while `docs/codex-master-plan/ACTIVE_PHASE.json` selects this exact phase and pack with `state=ready` and `human_approved=true`.

## Defect

`GET /api/public/matches?range=upcoming` currently performs a bounded oldest-first fixture query and applies the range predicate only after `take`. A database with many historical fixtures can therefore return no upcoming matches even when future fixtures exist.

The same bounded-query rule must be correct for `past`: the query must select past fixtures before `take` and return the most recent past fixtures first.

## Exact behavior

1. Capture one request-time `now` value.
2. For `range=upcoming`, add `startTimeUtc.gte=now` to the Prisma fixture query before `take`.
3. For `range=past`, add `startTimeUtc.lt=now` to the Prisma fixture query before `take`.
4. Keep upcoming order ascending and past order descending.
5. Preserve `all` and `live` semantics.
6. Preserve competition filtering, bounded limits, public DTOs, metadata, insight behavior, and sanitized error handling.
7. Do not delete fixture data and do not increase to an unbounded scan.
8. Add deterministic regression coverage with more out-of-range fixtures than the internal candidate bound.

## Exact payload

The canonical patch is stored as:

- `payload/chunks/part-00.b64.part`

Integrity identities:

- ordered canonical-LF chunk SHA-256: `c885c2d612e37c6c2e88c0e4c9556dd35db1f81366d1849ca8f536f8f76239a0`
- decoded gzip SHA-256: `f6dbbf475cf0e1da1221a2bf98946d57bc463087b0e90270d692d3f62b358b38`
- decoded canonical patch SHA-256: `48785761177d3769bbd2fbfb7944a3b098fc954ee9c72fd87da97a37cc40c45b`

Before applying, verify:

- baseline `f6eca5347f9522d14c75321f29bc0d1700160afe` is an ancestor of `HEAD`;
- `apps/api/src/public-api.ts` blob is `209bac4e6169e98ecfcbf71bfc931cf0c269dcf7`;
- `apps/api/src/public-api.test.ts` blob is `793b7f960012cd2a02fd1dccb0025dc7603ab22d`;
- both allowed targets are clean;
- neither target changed after the baseline;
- Automation v2 Validate passed.

### Canonical verification and application

```powershell
$pack = "docs/codex-master-plan/phases/phase-hotfix-public-matches-upcoming-v1"
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
$tempGzip = Join-Path $env:TEMP "matchpulse-hotfix-public-matches-upcoming-v1.patch.gz"
$tempPatch = Join-Path $env:TEMP "matchpulse-hotfix-public-matches-upcoming-v1.patch"
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

Do not hand-recreate, partially apply, reorder, recompress, or silently edit the payload.

## Exact allowed targets

1. `apps/api/src/public-api.ts`
2. `apps/api/src/public-api.test.ts`

Do not modify frontend files, Prisma, migrations, workers, TxLINE code, prediction code, dependencies, or documentation during phase execution.

The unrelated local modifications in `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` must remain exactly unchanged and unstaged.

## Required validation

Run every command from `manifest.json` in order. The focused test must prove that database time predicates are present before the bounded `take`, upcoming is nearest-first, and past is most-recent-first.

No runtime server smoke, network request, provider request, database mutation, migration, deployment, paid-service call, or production operation is authorized.

## Successful completion

Only after every validation passes:

1. change only the permitted completion fields in `ACTIVE_PHASE.json`;
2. retain the exact phase, pack, and baseline identity;
3. set `state=completed_pending_review` and `human_approved=false`;
4. record only actually changed allowed targets in `last_result.files_changed`;
5. record accurate validation, migration, and network facts;
6. keep `PHASE_QUEUE.json` unchanged;
7. run Automation v2 Prepare;
8. stop before Publish;
9. report `PHASE_COMPLETE_PREPARED`;
10. do not activate `10H-A` or any successor.

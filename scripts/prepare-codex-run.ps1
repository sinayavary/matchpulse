param(
  [string]$RepoRoot = "D:\money\matchpulse_repo",
  [ValidateSet("Validate", "Prepare", "Publish")]
  [string]$Mode = "Validate",
  [switch]$CopyPrompt,
  [switch]$ValidateOnly
)

$runner = Join-Path $PSScriptRoot "codex-automation-v2.ps1"
if (-not (Test-Path -LiteralPath $runner)) {
  Write-Error "MISSING_SOURCE: Automation v2 runner is missing: $runner"
  exit 1
}

if ($ValidateOnly) {
  $Mode = "Validate"
}

& $runner -RepoRoot $RepoRoot -Mode $Mode -CopyPrompt:$CopyPrompt
exit $LASTEXITCODE

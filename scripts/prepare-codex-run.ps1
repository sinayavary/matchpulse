param(
  [string]$RepoRoot = "D:\money\matchpulse_repo",
  [switch]$CopyPrompt,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Stop-WithCode {
  param(
    [string]$Code,
    [string]$Message
  )

  Write-Error "$Code`: $Message"
  exit 1
}

function Require-Property {
  param(
    [object]$Object,
    [string]$Name,
    [string]$Context
  )

  if ($null -eq $Object.PSObject.Properties[$Name]) {
    Stop-WithCode "SPEC_CONFLICT" "$Context is missing property '$Name'."
  }
}

function Invoke-Git {
  param([string[]]$Arguments)

  & git -C $script:Repo @Arguments
  return $LASTEXITCODE
}

try {
  $script:Repo = (Resolve-Path -LiteralPath $RepoRoot).Path
} catch {
  Stop-WithCode "SPEC_CONFLICT" "Repository root does not exist: $RepoRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $script:Repo ".git"))) {
  Stop-WithCode "SPEC_CONFLICT" "RepoRoot is not a Git repository."
}

$activeRelative = "docs/codex-master-plan/ACTIVE_PHASE.json"
$queueRelative = "docs/codex-master-plan/PHASE_QUEUE.json"
$entryRelative = "docs/codex-master-plan/CODEX_ENTRYPOINT.md"
$activePath = Join-Path $script:Repo $activeRelative
$queuePath = Join-Path $script:Repo $queueRelative
$entryPath = Join-Path $script:Repo $entryRelative

foreach ($path in @($activePath, $queuePath, $entryPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    Stop-WithCode "MISSING_SOURCE" "Required orchestration file is missing: $path"
  }
}

try {
  $active = Get-Content -LiteralPath $activePath -Raw | ConvertFrom-Json
  $queue = Get-Content -LiteralPath $queuePath -Raw | ConvertFrom-Json
} catch {
  Stop-WithCode "SPEC_CONFLICT" "Orchestration JSON is invalid: $($_.Exception.Message)"
}

foreach ($name in @(
  "schema_version",
  "project",
  "state",
  "phase_id",
  "phase_title",
  "pack_path",
  "pack_version",
  "baseline_commit",
  "human_approved",
  "activation_note",
  "execution",
  "last_result"
)) {
  Require-Property $active $name "ACTIVE_PHASE.json"
}

foreach ($name in @("schema_version", "project", "active_phase_id", "items")) {
  Require-Property $queue $name "PHASE_QUEUE.json"
}

if ($active.schema_version -ne "matchpulse-active-phase-v1") {
  Stop-WithCode "SPEC_CONFLICT" "Unsupported active-phase schema."
}
if ($queue.schema_version -ne "matchpulse-phase-queue-v1") {
  Stop-WithCode "SPEC_CONFLICT" "Unsupported phase-queue schema."
}
if ($active.project -ne "MatchPulse" -or $queue.project -ne "MatchPulse") {
  Stop-WithCode "SPEC_CONFLICT" "Orchestration project identity is invalid."
}
if ($queue.active_phase_id -ne $active.phase_id) {
  Stop-WithCode "SPEC_CONFLICT" "Queue and active-phase IDs do not match."
}

$knownStates = @(
  "awaiting_pack",
  "awaiting_human_approval",
  "ready",
  "paused",
  "completed_pending_review"
)
if ($knownStates -notcontains $active.state) {
  Stop-WithCode "SPEC_CONFLICT" "Unknown active-phase state '$($active.state)'."
}

$queueItem = @($queue.items | Where-Object { $_.id -eq $active.phase_id })
if ($queueItem.Count -ne 1) {
  Stop-WithCode "SPEC_CONFLICT" "Active phase must appear exactly once in PHASE_QUEUE.json."
}

Write-Host "Active MatchPulse phase:"
Write-Host "  ID:       $($active.phase_id)"
Write-Host "  Title:    $($active.phase_title)"
Write-Host "  State:    $($active.state)"
Write-Host "  Baseline: $($active.baseline_commit)"
Write-Host ""

switch ($active.state) {
  "awaiting_pack" {
    Write-Host "MISSING_SOURCE: the selected phase pack has not been installed."
    exit 0
  }
  "awaiting_human_approval" {
    Write-Host "HUMAN_APPROVAL_REQUIRED: the phase pack is not activated."
    exit 0
  }
  "paused" {
    Write-Host "PHASE_PAUSED: the active phase is intentionally paused."
    exit 0
  }
  "completed_pending_review" {
    Write-Host "The active phase is already complete and awaits human review."
    exit 0
  }
}

if ($active.state -ne "ready") {
  Stop-WithCode "SPEC_CONFLICT" "Unhandled active-phase state."
}

if ($active.human_approved -ne $true) {
  Stop-WithCode "HUMAN_APPROVAL_REQUIRED" "Ready state requires human_approved=true."
}
if ([string]::IsNullOrWhiteSpace([string]$active.pack_version)) {
  Stop-WithCode "SPEC_CONFLICT" "Ready state requires a pack_version."
}
if ([string]::IsNullOrWhiteSpace([string]$active.baseline_commit)) {
  Stop-WithCode "SPEC_CONFLICT" "Ready state requires a baseline_commit."
}

$packRelative = ([string]$active.pack_path).Replace("\", "/").Trim("/")
$packPath = Join-Path $script:Repo $packRelative
$requiredPackFiles = @(
  "README.md",
  "manifest.json",
  "EXPECTED_SHA256.json",
  "payload"
)
foreach ($name in $requiredPackFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $packPath $name))) {
    Stop-WithCode "MISSING_SOURCE" "Active phase pack is missing '$name'."
  }
}

try {
  $manifest = Get-Content -LiteralPath (Join-Path $packPath "manifest.json") -Raw |
    ConvertFrom-Json
} catch {
  Stop-WithCode "SPEC_CONFLICT" "Active phase manifest JSON is invalid."
}

foreach ($name in @(
  "schema_version",
  "phase",
  "pack_version",
  "baseline_commit",
  "allowed_target_files",
  "required_validation_commands",
  "expected_results",
  "allows_migration",
  "allows_network"
)) {
  Require-Property $manifest $name "phase manifest"
}

if ($manifest.schema_version -ne "matchpulse-phase-pack-v1") {
  Stop-WithCode "SPEC_CONFLICT" "Unsupported phase-pack schema."
}
if ($manifest.phase -ne $active.phase_id) {
  Stop-WithCode "SPEC_CONFLICT" "Manifest phase does not match ACTIVE_PHASE.json."
}
if ($manifest.pack_version -ne $active.pack_version) {
  Stop-WithCode "SPEC_CONFLICT" "Manifest pack version does not match ACTIVE_PHASE.json."
}
if ($manifest.baseline_commit -ne $active.baseline_commit) {
  Stop-WithCode "SPEC_CONFLICT" "Manifest baseline does not match ACTIVE_PHASE.json."
}
if (@($manifest.allowed_target_files).Count -eq 0) {
  Stop-WithCode "SPEC_CONFLICT" "Manifest allowed_target_files must not be empty."
}

& git -C $script:Repo cat-file -e "$($active.baseline_commit)^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
  Stop-WithCode "SPEC_CONFLICT" "Baseline commit does not exist."
}

& git -C $script:Repo merge-base --is-ancestor $active.baseline_commit HEAD
if ($LASTEXITCODE -ne 0) {
  Stop-WithCode "SPEC_CONFLICT" "Baseline commit is not an ancestor of HEAD."
}

foreach ($protected in @($activeRelative, $queueRelative, $packRelative)) {
  & git -C $script:Repo ls-files --error-unmatch -- $protected *> $null
  if ($LASTEXITCODE -ne 0) {
    Stop-WithCode "SPEC_CONFLICT" "Orchestration source is not committed: $protected"
  }

  & git -C $script:Repo diff --quiet -- $protected
  if ($LASTEXITCODE -ne 0) {
    Stop-WithCode "WORKSPACE_COLLISION" "Unstaged orchestration change exists: $protected"
  }

  & git -C $script:Repo diff --cached --quiet -- $protected
  if ($LASTEXITCODE -ne 0) {
    Stop-WithCode "WORKSPACE_COLLISION" "Staged orchestration change exists: $protected"
  }
}

foreach ($targetValue in @($manifest.allowed_target_files)) {
  $target = ([string]$targetValue).Replace("\", "/").Trim("/")
  if ([string]::IsNullOrWhiteSpace($target)) {
    Stop-WithCode "SPEC_CONFLICT" "Manifest contains an empty target path."
  }

  $status = & git -C $script:Repo status --porcelain -- $target
  if ($LASTEXITCODE -ne 0) {
    Stop-WithCode "SPEC_CONFLICT" "Unable to inspect target path: $target"
  }
  if (-not [string]::IsNullOrWhiteSpace(($status -join "`n"))) {
    Stop-WithCode "WORKSPACE_COLLISION" "Allowed target already has a local change: $target"
  }

  & git -C $script:Repo diff --quiet "$($active.baseline_commit)..HEAD" -- $target
  if ($LASTEXITCODE -ne 0) {
    Stop-WithCode "SPEC_CONFLICT" "Allowed target changed after the declared baseline: $target"
  }
}

Write-Host "Orchestration validation: PASS"
Write-Host "Allowed targets: $(@($manifest.allowed_target_files).Count)"
Write-Host "Migration allowed: $($manifest.allows_migration)"
Write-Host "Network allowed: $($manifest.allows_network)"
Write-Host ""

$prompt = "Work directly inside $script:Repo. Read AGENTS.md and $entryRelative, validate the repository-selected active phase, and execute it continuously until its declared phase gate or stop code. Do not ask for a phase-specific prompt and do not activate the next phase."

if ($CopyPrompt) {
  try {
    Set-Clipboard -Value $prompt
    Write-Host "Permanent Codex instruction copied to clipboard."
  } catch {
    Write-Warning "Clipboard copy failed. Use the printed instruction."
  }
}

if (-not $ValidateOnly) {
  Write-Host "Permanent Codex instruction:"
  Write-Host $prompt
}

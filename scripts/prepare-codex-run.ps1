param(
  [string]$RepoRoot = "D:\money\matchpulse_repo",
  [ValidateSet("Validate", "Prepare", "Publish")]
  [string]$Mode = "Validate",
  [switch]$CopyPrompt,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Stop-WithCode {
  param([string]$Code, [string]$Message)
  Write-Error "$Code`: $Message"
  exit 1
}

function Require-Property {
  param([object]$Object, [string]$Name, [string]$Context)
  if ($null -eq $Object.PSObject.Properties[$Name]) {
    Stop-WithCode "SPEC_CONFLICT" "$Context is missing property '$Name'."
  }
}

function Git-Lines {
  param([string[]]$Arguments, [switch]$AllowFailure)
  $output = @(& git -C $script:Repo @Arguments 2>&1)
  $exitCode = $LASTEXITCODE
  if (-not $AllowFailure -and $exitCode -ne 0) {
    Stop-WithCode "GIT_OPERATION_FAILED" "git $($Arguments -join ' ') failed: $($output -join ' ')"
  }
  return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

function Normalize-Path {
  param([string]$Path)
  return $Path.Replace("\", "/").Trim("/")
}

function Assert-Safe-Path {
  param([string]$Path, [string]$Context)
  $value = Normalize-Path $Path
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match "(^|/)\.\.(/|$)" -or [System.IO.Path]::IsPathRooted($value)) {
    Stop-WithCode "SPEC_CONFLICT" "$Context contains unsafe path '$Path'."
  }
  return $value
}

function Compare-ExactLists {
  param([object[]]$Expected, [object[]]$Actual, [string]$Code, [string]$Message)
  $difference = @(Compare-Object @($Expected) @($Actual))
  if ($difference.Count -ne 0) {
    Stop-WithCode $Code $Message
  }
}

function Read-Orchestration {
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

  foreach ($name in @("schema_version", "project", "state", "phase_id", "phase_title", "pack_path", "pack_version", "baseline_commit", "human_approved", "activation_note", "execution", "last_result")) {
    Require-Property $active $name "ACTIVE_PHASE.json"
  }
  foreach ($name in @("schema_version", "project", "active_phase_id", "items")) {
    Require-Property $queue $name "PHASE_QUEUE.json"
  }

  if ($active.schema_version -ne "matchpulse-active-phase-v1" -or $queue.schema_version -ne "matchpulse-phase-queue-v1") {
    Stop-WithCode "SPEC_CONFLICT" "Unsupported orchestration schema."
  }
  if ($active.project -ne "MatchPulse" -or $queue.project -ne "MatchPulse") {
    Stop-WithCode "SPEC_CONFLICT" "Orchestration project identity is invalid."
  }
  if ($queue.active_phase_id -ne $active.phase_id) {
    Stop-WithCode "SPEC_CONFLICT" "Queue and active-phase IDs do not match."
  }

  $knownStates = @("awaiting_pack", "awaiting_human_approval", "ready", "paused", "completed_pending_review")
  if ($knownStates -notcontains $active.state) {
    Stop-WithCode "SPEC_CONFLICT" "Unknown active-phase state '$($active.state)'."
  }

  $queueItem = @($queue.items | Where-Object { $_.id -eq $active.phase_id })
  if ($queueItem.Count -ne 1) {
    Stop-WithCode "SPEC_CONFLICT" "Active phase must appear exactly once in PHASE_QUEUE.json."
  }

  return [pscustomobject]@{
    Active = $active
    Queue = $queue
    ActiveRelative = $activeRelative
    QueueRelative = $queueRelative
    EntryRelative = $entryRelative
    ActivePath = $activePath
  }
}

function Get-Phase-Context {
  param([object]$State)
  $active = $State.Active

  Write-Host "Active MatchPulse phase:"
  Write-Host "  ID:       $($active.phase_id)"
  Write-Host "  Title:    $($active.phase_title)"
  Write-Host "  State:    $($active.state)"
  Write-Host "  Baseline: $($active.baseline_commit)"
  Write-Host ""

  switch ($active.state) {
    "awaiting_pack" { Stop-WithCode "MISSING_SOURCE" "The selected phase pack has not been installed." }
    "awaiting_human_approval" { Stop-WithCode "HUMAN_APPROVAL_REQUIRED" "The phase pack is not activated." }
    "paused" { Stop-WithCode "PHASE_PAUSED" "The active phase is intentionally paused." }
    "completed_pending_review" {
      Write-Host "The active phase is already complete and awaits human review."
      exit 0
    }
  }

  if ($active.state -ne "ready" -or $active.human_approved -ne $true) {
    Stop-WithCode "HUMAN_APPROVAL_REQUIRED" "Only an approved ready phase may execute."
  }
  if ([string]::IsNullOrWhiteSpace([string]$active.pack_version) -or [string]::IsNullOrWhiteSpace([string]$active.baseline_commit)) {
    Stop-WithCode "SPEC_CONFLICT" "Ready state requires pack_version and baseline_commit."
  }

  $packRelative = Assert-Safe-Path ([string]$active.pack_path) "ACTIVE_PHASE.json pack_path"
  $packPath = Join-Path $script:Repo $packRelative
  foreach ($name in @("README.md", "manifest.json", "EXPECTED_SHA256.json", "payload")) {
    if (-not (Test-Path -LiteralPath (Join-Path $packPath $name))) {
      Stop-WithCode "MISSING_SOURCE" "Active phase pack is missing '$name'."
    }
  }

  try {
    $manifest = Get-Content -LiteralPath (Join-Path $packPath "manifest.json") -Raw | ConvertFrom-Json
  } catch {
    Stop-WithCode "SPEC_CONFLICT" "Active phase manifest JSON is invalid."
  }

  foreach ($name in @("schema_version", "phase", "pack_version", "baseline_commit", "allowed_target_files", "required_validation_commands", "expected_results", "allows_migration", "allows_network")) {
    Require-Property $manifest $name "phase manifest"
  }
  if ($manifest.schema_version -ne "matchpulse-phase-pack-v1" -or $manifest.phase -ne $active.phase_id -or $manifest.pack_version -ne $active.pack_version -or $manifest.baseline_commit -ne $active.baseline_commit) {
    Stop-WithCode "SPEC_CONFLICT" "Active phase and manifest identity do not match."
  }

  $allowed = @($manifest.allowed_target_files | ForEach-Object { Assert-Safe-Path ([string]$_) "allowed_target_files" } | Sort-Object -Unique)
  if ($allowed.Count -eq 0 -or $allowed.Count -ne @($manifest.allowed_target_files).Count) {
    Stop-WithCode "SPEC_CONFLICT" "Manifest allowed_target_files must be non-empty and unique."
  }

  return [pscustomobject]@{
    Manifest = $manifest
    PackRelative = $packRelative
    AllowedTargets = $allowed
  }
}

function Get-Status-Lines {
  return @((Git-Lines @("status", "--porcelain=v1", "--untracked-files=all")).Output | Where-Object { $_ } | Sort-Object)
}

function Get-Allowed-Status-Lines {
  param([object]$State, [object]$Phase)
  $lines = @()
  foreach ($path in @($Phase.AllowedTargets + $State.ActiveRelative | Sort-Object -Unique)) {
    $lines += @((Git-Lines @("status", "--porcelain=v1", "--untracked-files=all", "--", $path)).Output | Where-Object { $_ })
  }
  return @($lines | Sort-Object -Unique)
}

function Get-Unrelated-Status-Lines {
  param([object]$State, [object]$Phase)
  $all = Get-Status-Lines
  $allowed = Get-Allowed-Status-Lines $State $Phase
  return @($all | Where-Object { $allowed -notcontains $_ } | Sort-Object)
}

function Assert-Main-And-Fetch {
  $inside = Git-Lines @("rev-parse", "--is-inside-work-tree")
  if (($inside.Output -join "").Trim() -ne "true") {
    Stop-WithCode "SPEC_CONFLICT" "RepoRoot is not a Git repository."
  }
  $branch = ((Git-Lines @("branch", "--show-current")).Output -join "").Trim()
  if ($branch -ne "main") {
    Stop-WithCode "WRONG_BRANCH" "Automation v2 executes phases only from local main. Current branch: '$branch'."
  }
  Git-Lines @("fetch", "--prune", "origin", "main") | Out-Null
}

function Validate-Phase-Workspace {
  param([object]$State, [object]$Phase)
  Assert-Main-And-Fetch

  $head = ((Git-Lines @("rev-parse", "HEAD")).Output -join "").Trim()
  $originMain = ((Git-Lines @("rev-parse", "origin/main")).Output -join "").Trim()
  $mergeBase = ((Git-Lines @("merge-base", "HEAD", "origin/main")).Output -join "").Trim()
  if ($head -ne $originMain) {
    if ($mergeBase -eq $head) {
      Git-Lines @("merge", "--ff-only", "origin/main") | Out-Null
      $head = ((Git-Lines @("rev-parse", "HEAD")).Output -join "").Trim()
    } else {
      Stop-WithCode "NON_FAST_FORWARD" "Local main is ahead of or diverged from origin/main."
    }
  }

  $baselineCheck = Git-Lines @("merge-base", "--is-ancestor", $State.Active.baseline_commit, "HEAD") -AllowFailure
  if ($baselineCheck.ExitCode -ne 0) {
    Stop-WithCode "SPEC_CONFLICT" "Baseline commit is not an ancestor of HEAD."
  }

  foreach ($path in @($State.ActiveRelative, $State.QueueRelative, $State.EntryRelative, $Phase.PackRelative)) {
    $tracked = Git-Lines @("ls-files", "--error-unmatch", "--", $path) -AllowFailure
    if ($tracked.ExitCode -ne 0) {
      Stop-WithCode "SPEC_CONFLICT" "Orchestration source is not committed: $path"
    }
    $status = @((Git-Lines @("status", "--porcelain=v1", "--", $path)).Output | Where-Object { $_ })
    if ($status.Count -gt 0) {
      Stop-WithCode "WORKSPACE_COLLISION" "Orchestration source has a local change: $path"
    }
  }

  foreach ($target in $Phase.AllowedTargets) {
    $status = @((Git-Lines @("status", "--porcelain=v1", "--", $target)).Output | Where-Object { $_ })
    if ($status.Count -gt 0) {
      Stop-WithCode "WORKSPACE_COLLISION" "Allowed target already has a local change: $target"
    }
    $changed = Git-Lines @("diff", "--quiet", "$($State.Active.baseline_commit)..HEAD", "--", $target) -AllowFailure
    if ($changed.ExitCode -ne 0) {
      Stop-WithCode "SPEC_CONFLICT" "Allowed target changed after the declared baseline: $target"
    }
  }

  $snapshot = [ordered]@{
    schema_version = "matchpulse-codex-automation-snapshot-v2"
    head = $head
    origin_main = $originMain
    phase_id = $State.Active.phase_id
    pack_version = $State.Active.pack_version
    allowed_targets = @($Phase.AllowedTargets)
    unrelated_status = @(Get-Unrelated-Status-Lines $State $Phase)
    created_at = [DateTime]::UtcNow.ToString("o")
  }
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $script:SnapshotPath -Encoding utf8

  return [pscustomobject]@{ Head = $head; OriginMain = $originMain }
}

function Read-Prepare-Snapshot {
  param([object]$State, [object]$Phase)
  if (-not (Test-Path -LiteralPath $script:SnapshotPath)) {
    Stop-WithCode "MISSING_VALIDATION_SNAPSHOT" "Run Automation v2 Validate before implementation."
  }
  try {
    $snapshot = Get-Content -LiteralPath $script:SnapshotPath -Raw | ConvertFrom-Json
  } catch {
    Stop-WithCode "SPEC_CONFLICT" "Automation validation snapshot is invalid."
  }
  if ($snapshot.schema_version -ne "matchpulse-codex-automation-snapshot-v2" -or $snapshot.phase_id -ne $State.Active.phase_id -or $snapshot.pack_version -ne $State.Active.pack_version) {
    Stop-WithCode "SPEC_CONFLICT" "Validation snapshot does not match the active phase."
  }
  Compare-ExactLists @($snapshot.allowed_targets | Sort-Object) @($Phase.AllowedTargets | Sort-Object) "SPEC_CONFLICT" "Validation snapshot allowlist changed."
  return $snapshot
}

function Prepare-Phase-Commit {
  param([object]$State, [object]$Phase)
  Assert-Main-And-Fetch
  $snapshot = Read-Prepare-Snapshot $State $Phase

  $head = ((Git-Lines @("rev-parse", "HEAD")).Output -join "").Trim()
  $originMain = ((Git-Lines @("rev-parse", "origin/main")).Output -join "").Trim()
  if ($head -ne $snapshot.head -or $originMain -ne $snapshot.origin_main -or $head -ne $originMain) {
    Stop-WithCode "NON_FAST_FORWARD" "HEAD or origin/main changed after validation; restart from Validate."
  }

  foreach ($path in @($State.QueueRelative, $State.EntryRelative, $Phase.PackRelative)) {
    $status = @((Git-Lines @("status", "--porcelain=v1", "--", $path)).Output | Where-Object { $_ })
    if ($status.Count -gt 0) {
      Stop-WithCode "WORKSPACE_COLLISION" "Protected orchestration source changed during execution: $path"
    }
  }

  $currentUnrelated = @(Get-Unrelated-Status-Lines $State $Phase)
  Compare-ExactLists @($snapshot.unrelated_status | Sort-Object) $currentUnrelated "UNRELATED_WORK_CHANGED" "Unrelated local changes were added, removed, or modified during phase execution."

  $changed = @()
  foreach ($path in @($Phase.AllowedTargets + $State.ActiveRelative | Sort-Object -Unique)) {
    $pathStatus = @((Git-Lines @("status", "--porcelain=v1", "--", $path)).Output | Where-Object { $_ })
    if ($pathStatus.Count -gt 0) { $changed += $path }
  }
  $changed = @($changed | Sort-Object -Unique)
  if ($changed.Count -eq 0) {
    Stop-WithCode "NOTHING_TO_COMMIT" "No active-phase changes were produced."
  }
  if ($changed -notcontains $State.ActiveRelative) {
    Stop-WithCode "SPEC_CONFLICT" "Successful phase execution must include ACTIVE_PHASE.json completion metadata."
  }

  $activeNow = Get-Content -LiteralPath $State.ActivePath -Raw | ConvertFrom-Json
  if ($activeNow.state -ne "completed_pending_review" -or $activeNow.human_approved -ne $false -or $activeNow.last_result.status -ne "PHASE_COMPLETE") {
    Stop-WithCode "SPEC_CONFLICT" "ACTIVE_PHASE.json does not contain the required completion transition."
  }
  if ($activeNow.phase_id -ne $State.Active.phase_id -or $activeNow.pack_version -ne $State.Active.pack_version -or $activeNow.baseline_commit -ne $State.Active.baseline_commit) {
    Stop-WithCode "SPEC_CONFLICT" "Completion metadata changed immutable phase identity."
  }

  $declaredChanged = @($activeNow.last_result.files_changed | ForEach-Object { Normalize-Path ([string]$_) } | Sort-Object -Unique)
  $actualTargets = @($changed | Where-Object { $_ -ne $State.ActiveRelative } | Sort-Object -Unique)
  Compare-ExactLists $declaredChanged $actualTargets "SPEC_CONFLICT" "last_result.files_changed does not match the implementation diff."

  Git-Lines @("diff", "--check", "--", @($changed)) | Out-Null
  foreach ($path in $changed) {
    Git-Lines @("add", "--", $path) | Out-Null
  }

  $staged = @((Git-Lines @("diff", "--cached", "--name-only")).Output | Where-Object { $_ } | ForEach-Object { Normalize-Path $_ } | Sort-Object -Unique)
  Compare-ExactLists $changed $staged "STAGING_SCOPE_VIOLATION" "The index differs from the exact phase allowlist diff."

  $subject = "Complete Phase $($State.Active.phase_id) $($State.Active.phase_title.ToLowerInvariant())"
  Git-Lines @("commit", "-m", $subject) | Out-Null
  $commit = ((Git-Lines @("rev-parse", "HEAD")).Output -join "").Trim()
  $parent = ((Git-Lines @("rev-parse", "HEAD^1")).Output -join "").Trim()
  if ($parent -ne $originMain) {
    Stop-WithCode "NON_FAST_FORWARD" "Prepared commit parent is not origin/main."
  }

  Write-Host "Prepared phase commit: $commit"
  Write-Host "Unrelated local changes remain unchanged and unstaged."
}

function Publish-Phase-Commit {
  param([object]$State)
  Assert-Main-And-Fetch

  if ($State.Active.state -ne "completed_pending_review" -or $State.Active.last_result.status -ne "PHASE_COMPLETE") {
    Stop-WithCode "SPEC_CONFLICT" "Publish requires committed completed_pending_review metadata."
  }

  $staged = @((Git-Lines @("diff", "--cached", "--name-only")).Output | Where-Object { $_ })
  if ($staged.Count -gt 0) {
    Stop-WithCode "STAGING_SCOPE_VIOLATION" "Publish requires an empty index."
  }

  $originMain = ((Git-Lines @("rev-parse", "origin/main")).Output -join "").Trim()
  $parent = ((Git-Lines @("rev-parse", "HEAD^1")).Output -join "").Trim()
  $ahead = [int](((Git-Lines @("rev-list", "--count", "origin/main..HEAD")).Output -join "").Trim())
  if ($parent -ne $originMain -or $ahead -ne 1) {
    Stop-WithCode "NON_FAST_FORWARD" "Publish requires exactly one prepared commit directly above origin/main."
  }

  $declared = @($State.Active.last_result.files_changed | ForEach-Object { Normalize-Path ([string]$_) } | Sort-Object -Unique)
  $expected = @($declared + $State.ActiveRelative | Sort-Object -Unique)
  $actual = @((Git-Lines @("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")).Output | Where-Object { $_ } | ForEach-Object { Normalize-Path $_ } | Sort-Object -Unique)
  Compare-ExactLists $expected $actual "STAGING_SCOPE_VIOLATION" "Prepared commit contains files outside the phase allowlist."

  Git-Lines @("push", "origin", "HEAD:main") | Out-Null
  Write-Host "Published HEAD to origin/main without force."
  Write-Host "Unrelated unstaged/untracked local changes remain preserved."
}

try {
  $script:Repo = (Resolve-Path -LiteralPath $RepoRoot).Path
} catch {
  Stop-WithCode "SPEC_CONFLICT" "Repository root does not exist: $RepoRoot"
}
$script:SnapshotPath = Join-Path $script:Repo ".git\codex-automation-v2-snapshot.json"
if ($ValidateOnly) { $Mode = "Validate" }

$state = Read-Orchestration
if ($Mode -eq "Publish") {
  Publish-Phase-Commit $state
  exit 0
}

$phase = Get-Phase-Context $state
if ($Mode -eq "Prepare") {
  Prepare-Phase-Commit $state $phase
  exit 0
}

$repoState = Validate-Phase-Workspace $state $phase
Write-Host "Automation v2 validation: PASS"
Write-Host "Synchronized HEAD: $($repoState.Head)"
Write-Host "Allowed implementation targets: $($phase.AllowedTargets.Count)"
Write-Host "Migration allowed: $($phase.Manifest.allows_migration)"
Write-Host "Network allowed: $($phase.Manifest.allows_network)"
Write-Host ""

$prompt = "Work directly inside $script:Repo. Read AGENTS.md and $($state.EntryRelative). Run .\scripts\prepare-codex-run.ps1 -Mode Validate, execute only the repository-selected active phase, run every validation in its pack, update only the permitted completion metadata, then run .\scripts\prepare-codex-run.ps1 -Mode Prepare. Do not activate the next phase and do not run Publish unless the human explicitly instructs it."
if ($CopyPrompt) {
  try { Set-Clipboard -Value $prompt } catch { Write-Warning "Clipboard copy failed." }
}
Write-Host "Permanent Codex instruction:"
Write-Host $prompt

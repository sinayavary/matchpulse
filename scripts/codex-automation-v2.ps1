param(
  [string]$RepoRoot = "D:\money\matchpulse_repo",
  [ValidateSet("Validate", "Prepare", "Publish")]
  [string]$Mode = "Validate",
  [switch]$CopyPrompt
)

$ErrorActionPreference = "Stop"

function Stop-Code([string]$Code, [string]$Message) {
  Write-Error "$Code`: $Message"
  exit 1
}

function Git([string[]]$Args, [switch]$AllowFailure) {
  $output = @(& git -C $script:Repo @Args 2>&1)
  $code = $LASTEXITCODE
  if (-not $AllowFailure -and $code -ne 0) {
    Stop-Code "GIT_OPERATION_FAILED" "git $($Args -join ' ') failed: $($output -join ' ')"
  }
  [pscustomobject]@{ Code = $code; Lines = $output }
}

function Need($Object, [string]$Name, [string]$Context) {
  if ($null -eq $Object.PSObject.Properties[$Name]) {
    Stop-Code "SPEC_CONFLICT" "$Context is missing '$Name'."
  }
}

function Path-Normal([string]$Value) {
  $path = $Value.Replace("\", "/").Trim("/")
  if ([string]::IsNullOrWhiteSpace($path) -or $path -match "(^|/)\.\.(/|$)" -or [IO.Path]::IsPathRooted($path)) {
    Stop-Code "SPEC_CONFLICT" "Unsafe repository path: '$Value'."
  }
  $path
}

function Same-List($Expected, $Actual, [string]$Code, [string]$Message) {
  if (@(Compare-Object @($Expected) @($Actual)).Count -ne 0) {
    Stop-Code $Code $Message
  }
}

function Read-State {
  $activeRel = "docs/codex-master-plan/ACTIVE_PHASE.json"
  $queueRel = "docs/codex-master-plan/PHASE_QUEUE.json"
  $entryRel = "docs/codex-master-plan/CODEX_ENTRYPOINT.md"
  foreach ($path in @($activeRel, $queueRel, $entryRel)) {
    if (-not (Test-Path -LiteralPath (Join-Path $script:Repo $path))) {
      Stop-Code "MISSING_SOURCE" "Missing orchestration file: $path"
    }
  }
  try {
    $active = Get-Content (Join-Path $script:Repo $activeRel) -Raw | ConvertFrom-Json
    $queue = Get-Content (Join-Path $script:Repo $queueRel) -Raw | ConvertFrom-Json
  } catch {
    Stop-Code "SPEC_CONFLICT" "Invalid orchestration JSON: $($_.Exception.Message)"
  }
  foreach ($name in @("schema_version","project","state","phase_id","phase_title","pack_path","pack_version","baseline_commit","human_approved","execution","last_result")) {
    Need $active $name "ACTIVE_PHASE.json"
  }
  foreach ($name in @("schema_version","project","active_phase_id","items")) {
    Need $queue $name "PHASE_QUEUE.json"
  }
  if ($active.schema_version -ne "matchpulse-active-phase-v1" -or $queue.schema_version -ne "matchpulse-phase-queue-v1") {
    Stop-Code "SPEC_CONFLICT" "Unsupported orchestration schema."
  }
  if ($active.project -ne "MatchPulse" -or $queue.project -ne "MatchPulse" -or $queue.active_phase_id -ne $active.phase_id) {
    Stop-Code "SPEC_CONFLICT" "Orchestration identity mismatch."
  }
  if (@($queue.items | Where-Object { $_.id -eq $active.phase_id }).Count -ne 1) {
    Stop-Code "SPEC_CONFLICT" "Active phase must occur exactly once in PHASE_QUEUE.json."
  }
  [pscustomobject]@{
    Active = $active
    Queue = $queue
    ActiveRel = $activeRel
    QueueRel = $queueRel
    EntryRel = $entryRel
    ActivePath = Join-Path $script:Repo $activeRel
  }
}

function Read-Pack($State) {
  $active = $State.Active
  switch ($active.state) {
    "awaiting_pack" { Stop-Code "MISSING_SOURCE" "The selected phase pack is absent." }
    "awaiting_human_approval" { Stop-Code "HUMAN_APPROVAL_REQUIRED" "The selected phase is not approved." }
    "paused" { Stop-Code "PHASE_PAUSED" "The selected phase is paused." }
    "completed_pending_review" { Write-Host "The active phase is complete and awaits review."; exit 0 }
    "ready" { }
    default { Stop-Code "SPEC_CONFLICT" "Unknown active-phase state '$($active.state)'." }
  }
  if ($active.human_approved -ne $true -or [string]::IsNullOrWhiteSpace([string]$active.pack_version)) {
    Stop-Code "HUMAN_APPROVAL_REQUIRED" "A ready phase requires approval and pack_version."
  }
  $packRel = Path-Normal ([string]$active.pack_path)
  $packPath = Join-Path $script:Repo $packRel
  foreach ($name in @("README.md","manifest.json","EXPECTED_SHA256.json","payload")) {
    if (-not (Test-Path -LiteralPath (Join-Path $packPath $name))) {
      Stop-Code "MISSING_SOURCE" "Phase pack is missing '$name'."
    }
  }
  try { $manifest = Get-Content (Join-Path $packPath "manifest.json") -Raw | ConvertFrom-Json }
  catch { Stop-Code "SPEC_CONFLICT" "Invalid phase manifest JSON." }
  foreach ($name in @("schema_version","phase","pack_version","baseline_commit","allowed_target_files","required_validation_commands","expected_results","allows_migration","allows_network")) {
    Need $manifest $name "phase manifest"
  }
  if ($manifest.schema_version -ne "matchpulse-phase-pack-v1" -or $manifest.phase -ne $active.phase_id -or $manifest.pack_version -ne $active.pack_version -or $manifest.baseline_commit -ne $active.baseline_commit) {
    Stop-Code "SPEC_CONFLICT" "Phase manifest identity mismatch."
  }
  $allowed = @($manifest.allowed_target_files | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  if ($allowed.Count -eq 0 -or $allowed.Count -ne @($manifest.allowed_target_files).Count) {
    Stop-Code "SPEC_CONFLICT" "allowed_target_files must be non-empty and unique."
  }
  [pscustomobject]@{ Manifest = $manifest; PackRel = $packRel; Allowed = $allowed }
}

function Require-Main-And-Fetch {
  if (((Git @("rev-parse","--is-inside-work-tree")).Lines -join "").Trim() -ne "true") {
    Stop-Code "SPEC_CONFLICT" "RepoRoot is not a Git repository."
  }
  $branch = ((Git @("branch","--show-current")).Lines -join "").Trim()
  if ($branch -ne "main") { Stop-Code "WRONG_BRANCH" "Current branch is '$branch'; expected main." }
  Git @("fetch","--prune","origin","main") | Out-Null
}

function Status-All { @((Git @("status","--porcelain=v1","--untracked-files=all")).Lines | Where-Object { $_ } | Sort-Object) }

function Status-For($Paths) {
  $lines = @()
  foreach ($path in @($Paths | Sort-Object -Unique)) {
    $lines += @((Git @("status","--porcelain=v1","--untracked-files=all","--",$path)).Lines | Where-Object { $_ })
  }
  @($lines | Sort-Object -Unique)
}

function Status-Unrelated($State, $Pack) {
  $all = Status-All
  $phase = Status-For @($Pack.Allowed + $State.ActiveRel)
  @($all | Where-Object { $phase -notcontains $_ } | Sort-Object)
}

function Validate($State, $Pack) {
  Require-Main-And-Fetch
  $head = ((Git @("rev-parse","HEAD")).Lines -join "").Trim()
  $origin = ((Git @("rev-parse","origin/main")).Lines -join "").Trim()
  if ($head -ne $origin) {
    $base = ((Git @("merge-base","HEAD","origin/main")).Lines -join "").Trim()
    if ($base -ne $head) { Stop-Code "NON_FAST_FORWARD" "Local main is ahead or diverged." }
    Git @("merge","--ff-only","origin/main") | Out-Null
    $head = ((Git @("rev-parse","HEAD")).Lines -join "").Trim()
  }
  if ((Git @("merge-base","--is-ancestor",$State.Active.baseline_commit,"HEAD") -AllowFailure).Code -ne 0) {
    Stop-Code "SPEC_CONFLICT" "Pack baseline is not an ancestor of HEAD."
  }
  foreach ($path in @($State.ActiveRel,$State.QueueRel,$State.EntryRel,$Pack.PackRel)) {
    if ((Git @("ls-files","--error-unmatch","--",$path) -AllowFailure).Code -ne 0) { Stop-Code "SPEC_CONFLICT" "Untracked governance source: $path" }
    if ((Status-For @($path)).Count -gt 0) { Stop-Code "WORKSPACE_COLLISION" "Governance source is locally changed: $path" }
  }
  foreach ($path in $Pack.Allowed) {
    if ((Status-For @($path)).Count -gt 0) { Stop-Code "WORKSPACE_COLLISION" "Allowed target is already changed: $path" }
    if ((Git @("diff","--quiet","$($State.Active.baseline_commit)..HEAD","--",$path) -AllowFailure).Code -ne 0) {
      Stop-Code "SPEC_CONFLICT" "Allowed target changed after the pack baseline: $path"
    }
  }
  $snapshot = [ordered]@{
    schema_version = "matchpulse-codex-automation-snapshot-v2"
    head = $head
    origin_main = $origin
    phase_id = $State.Active.phase_id
    pack_version = $State.Active.pack_version
    allowed_targets = @($Pack.Allowed)
    unrelated_status = @(Status-Unrelated $State $Pack)
    created_at = [DateTime]::UtcNow.ToString("o")
  }
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $script:Snapshot -Encoding utf8
  Write-Host "AUTOMATION_V2_VALIDATED"
  Write-Host "HEAD: $head"
}

function Prepare($State, $Pack) {
  Require-Main-And-Fetch
  if (-not (Test-Path $script:Snapshot)) { Stop-Code "MISSING_VALIDATION_SNAPSHOT" "Run Validate before implementation." }
  try { $snapshot = Get-Content $script:Snapshot -Raw | ConvertFrom-Json }
  catch { Stop-Code "SPEC_CONFLICT" "Invalid Automation v2 snapshot." }
  if ($snapshot.schema_version -ne "matchpulse-codex-automation-snapshot-v2" -or $snapshot.phase_id -ne $State.Active.phase_id -or $snapshot.pack_version -ne $State.Active.pack_version) {
    Stop-Code "SPEC_CONFLICT" "Snapshot does not match the active phase."
  }
  Same-List @($snapshot.allowed_targets | Sort-Object) @($Pack.Allowed | Sort-Object) "SPEC_CONFLICT" "Allowlist changed after Validate."
  $head = ((Git @("rev-parse","HEAD")).Lines -join "").Trim()
  $origin = ((Git @("rev-parse","origin/main")).Lines -join "").Trim()
  if ($head -ne $snapshot.head -or $origin -ne $snapshot.origin_main -or $head -ne $origin) {
    Stop-Code "NON_FAST_FORWARD" "HEAD or origin/main changed after Validate."
  }
  foreach ($path in @($State.QueueRel,$State.EntryRel,$Pack.PackRel)) {
    if ((Status-For @($path)).Count -gt 0) { Stop-Code "WORKSPACE_COLLISION" "Protected governance source changed: $path" }
  }
  Same-List @($snapshot.unrelated_status | Sort-Object) @(Status-Unrelated $State $Pack) "UNRELATED_WORK_CHANGED" "Unrelated local work changed during execution."

  $candidate = @($Pack.Allowed + $State.ActiveRel | Sort-Object -Unique)
  $changed = @()
  foreach ($path in $candidate) { if ((Status-For @($path)).Count -gt 0) { $changed += $path } }
  $changed = @($changed | Sort-Object -Unique)
  if ($changed.Count -eq 0) { Stop-Code "NOTHING_TO_COMMIT" "No phase changes exist." }
  if ($changed -notcontains $State.ActiveRel) { Stop-Code "SPEC_CONFLICT" "ACTIVE_PHASE.json completion metadata is missing." }

  $done = Get-Content $State.ActivePath -Raw | ConvertFrom-Json
  if ($done.state -ne "completed_pending_review" -or $done.human_approved -ne $false -or $done.last_result.status -ne "PHASE_COMPLETE") {
    Stop-Code "SPEC_CONFLICT" "Invalid completion transition."
  }
  if ($done.phase_id -ne $State.Active.phase_id -or $done.pack_version -ne $State.Active.pack_version -or $done.baseline_commit -ne $State.Active.baseline_commit) {
    Stop-Code "SPEC_CONFLICT" "Immutable phase identity changed."
  }
  $declared = @($done.last_result.files_changed | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  $actualTargets = @($changed | Where-Object { $_ -ne $State.ActiveRel } | Sort-Object -Unique)
  Same-List $declared $actualTargets "SPEC_CONFLICT" "last_result.files_changed does not match the actual phase diff."

  $checkArgs = @("diff","--check","--") + $changed
  Git $checkArgs | Out-Null
  foreach ($path in $changed) { Git @("add","--",$path) | Out-Null }
  $staged = @((Git @("diff","--cached","--name-only")).Lines | Where-Object { $_ } | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  Same-List $changed $staged "STAGING_SCOPE_VIOLATION" "Staged files differ from the exact phase diff."
  Git @("commit","-m","Complete Phase $($State.Active.phase_id) $($State.Active.phase_title.ToLowerInvariant())") | Out-Null
  $parent = ((Git @("rev-parse","HEAD^1")).Lines -join "").Trim()
  if ($parent -ne $origin) { Stop-Code "NON_FAST_FORWARD" "Prepared commit parent is not origin/main." }
  Write-Host "AUTOMATION_V2_PREPARED"
  Write-Host "Unrelated local work remains unchanged and unstaged."
}

function Publish($State) {
  Require-Main-And-Fetch
  if ($State.Active.state -ne "completed_pending_review" -or $State.Active.last_result.status -ne "PHASE_COMPLETE") {
    Stop-Code "SPEC_CONFLICT" "Publish requires committed completion metadata."
  }
  if (@((Git @("diff","--cached","--name-only")).Lines | Where-Object { $_ }).Count -gt 0) {
    Stop-Code "STAGING_SCOPE_VIOLATION" "Publish requires an empty index."
  }
  $origin = ((Git @("rev-parse","origin/main")).Lines -join "").Trim()
  $parent = ((Git @("rev-parse","HEAD^1")).Lines -join "").Trim()
  $ahead = [int](((Git @("rev-list","--count","origin/main..HEAD")).Lines -join "").Trim())
  if ($parent -ne $origin -or $ahead -ne 1) { Stop-Code "NON_FAST_FORWARD" "Expected exactly one prepared commit above origin/main." }
  $declared = @($State.Active.last_result.files_changed | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  $expected = @($declared + $State.ActiveRel | Sort-Object -Unique)
  $actual = @((Git @("diff-tree","--no-commit-id","--name-only","-r","HEAD")).Lines | Where-Object { $_ } | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  Same-List $expected $actual "STAGING_SCOPE_VIOLATION" "Prepared commit contains unauthorized files."
  Git @("push","origin","HEAD:main") | Out-Null
  Write-Host "AUTOMATION_V2_PUBLISHED"
  Write-Host "Unrelated local work remains preserved."
}

try { $script:Repo = (Resolve-Path -LiteralPath $RepoRoot).Path }
catch { Stop-Code "SPEC_CONFLICT" "Repository root does not exist: $RepoRoot" }
$script:Snapshot = Join-Path $script:Repo ".git\codex-automation-v2-snapshot.json"
$state = Read-State

if ($Mode -eq "Publish") { Publish $state; exit 0 }
$pack = Read-Pack $state
if ($Mode -eq "Prepare") { Prepare $state $pack; exit 0 }
Validate $state $pack

$prompt = "Work directly inside $script:Repo. Read AGENTS.md and $($state.EntryRel). Run .\scripts\codex-automation-v2.ps1 -Mode Validate, execute only the repository-selected active phase and all pack validations, update only permitted completion metadata, then run .\scripts\codex-automation-v2.ps1 -Mode Prepare. Stop before Publish and never activate the next phase."
if ($CopyPrompt) { try { Set-Clipboard $prompt } catch { Write-Warning "Clipboard copy failed." } }
Write-Host $prompt

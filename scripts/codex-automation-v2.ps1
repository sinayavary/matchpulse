param(
  [string]$RepoRoot = "D:\money\matchpulse_repo",
  [ValidateSet("Validate", "Prepare", "Publish", "ProgramTransition")]
  [string]$Mode = "Validate",
  [switch]$CopyPrompt
)

$ErrorActionPreference = "Stop"

function Stop-Code([string]$Code, [string]$Message) { Write-Error "$Code`: $Message"; exit 1 }
function Invoke-SafeGit([string[]]$GitArgs, [switch]$AllowFailure) {
  $prior = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  $output = @(& git -C $script:Repo @GitArgs 2>&1); $code = $LASTEXITCODE
  $ErrorActionPreference = $prior
  if (-not $AllowFailure -and $code -ne 0) { Stop-Code "GIT_OPERATION_FAILED" "git $($GitArgs -join ' ') failed: $($output -join ' ')" }
  [pscustomobject]@{ Code = $code; Lines = $output }
}
function Need($Object, [string]$Name, [string]$Context) {
  if ($null -eq $Object -or $null -eq $Object.PSObject.Properties[$Name]) { Stop-Code "SPEC_CONFLICT" "$Context is missing '$Name'." }
}
function Path-Normal([string]$Value) {
  $path = $Value.Replace("\", "/").Trim("/")
  if ([string]::IsNullOrWhiteSpace($path) -or $path -match "(^|/)\.\.(/|$)" -or [IO.Path]::IsPathRooted($path)) { Stop-Code "SPEC_CONFLICT" "Unsafe repository path: '$Value'." }
  $path
}
function Same-List($Expected, $Actual, [string]$Code, [string]$Message) {
  if (@(Compare-Object @($Expected) @($Actual)).Count -ne 0) { Stop-Code $Code $Message }
}
function Read-Json([string]$Relative, [string]$Context) {
  $path = Join-Path $script:Repo $Relative
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Code "MISSING_SOURCE" "Missing $Context`: $Relative" }
  try { Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } catch { Stop-Code "SPEC_CONFLICT" "Invalid $Context JSON: $Relative" }
}
function Read-State {
  $activeRel = "docs/codex-master-plan/ACTIVE_PHASE.json"; $queueRel = "docs/codex-master-plan/PHASE_QUEUE.json"; $entryRel = "docs/codex-master-plan/CODEX_ENTRYPOINT.md"
  $active = Read-Json $activeRel "orchestration"; $queue = Read-Json $queueRel "orchestration"
  if (-not (Test-Path -LiteralPath (Join-Path $script:Repo $entryRel))) { Stop-Code "MISSING_SOURCE" "Missing orchestration file: $entryRel" }
  foreach ($name in @("schema_version","project","state","phase_id","phase_title","pack_path","pack_version","baseline_commit","human_approved","execution","last_result")) { Need $active $name "ACTIVE_PHASE.json" }
  foreach ($name in @("schema_version","project","active_phase_id","items")) { Need $queue $name "PHASE_QUEUE.json" }
  if ($active.schema_version -ne "matchpulse-active-phase-v1" -or $queue.schema_version -ne "matchpulse-phase-queue-v1" -or $active.project -ne "MatchPulse" -or $queue.project -ne "MatchPulse") { Stop-Code "SPEC_CONFLICT" "Unsupported orchestration schema." }
  if ($queue.active_phase_id -ne $active.phase_id -or @($queue.items | Where-Object { $_.id -eq $active.phase_id }).Count -ne 1) { Stop-Code "SPEC_CONFLICT" "Orchestration identity mismatch." }
  [pscustomobject]@{ Active=$active; Queue=$queue; ActiveRel=$activeRel; QueueRel=$queueRel; EntryRel=$entryRel; ActivePath=(Join-Path $script:Repo $activeRel) }
}
function Read-Program {
  $program = Read-Json "docs/codex-master-plan/PROGRAM_PLAN.json" "program plan"
  Need $program "program_mode" "PROGRAM_PLAN.json"; Need $program "safe_auto_publication_policy" "PROGRAM_PLAN.json"; Need $program "phases" "PROGRAM_PLAN.json"
  $program
}
function Test-PayloadHashes([string]$PackRel) {
  $expected = Read-Json "$PackRel/EXPECTED_SHA256.json" "payload hashes"
  $entries = if ($null -ne $expected.files) { @($expected.files.PSObject.Properties | ForEach-Object { [pscustomobject]@{ path=$_.Name; sha256=$_.Value } }) } elseif ($expected -is [System.Array]) { @($expected) } else { @($expected.PSObject.Properties | ForEach-Object { [pscustomobject]@{ path=$_.Name; sha256=$_.Value } }) }
  foreach ($entry in $entries) {
    $rel = if ($null -ne $entry.path) { Path-Normal ([string]$entry.path) } elseif ($null -ne $entry.file) { Path-Normal ([string]$entry.file) } else { Stop-Code "SPEC_CONFLICT" "Payload hash entry lacks a path." }
    $hash = if ($null -ne $entry.sha256) { [string]$entry.sha256 } elseif ($null -ne $entry.hash) { [string]$entry.hash } else { Stop-Code "SPEC_CONFLICT" "Payload hash entry lacks SHA-256." }
    $full = Join-Path $script:Repo "$PackRel/payload/$rel"
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { Stop-Code "SPEC_CONFLICT" "Payload file is missing: $rel" }
    $actual = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $hash.ToLowerInvariant()) {
      # Git may materialize text payloads with CRLF on Windows. Integrity is
      # defined over the repository-canonical LF bytes, while binary files
      # continue to require an exact raw-byte match.
      try {
        $text = [IO.File]::ReadAllText($full, [Text.UTF8Encoding]::new($false, $true))
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($text.Replace("`r`n", "`n"))
        $sha = [Security.Cryptography.SHA256]::Create()
        $actual = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
      } catch { }
      if ($actual -ne $hash.ToLowerInvariant()) { Stop-Code "SPEC_CONFLICT" "Payload SHA-256 mismatch: $rel" }
    }
  }
}
function Read-Pack($State, [string]$RequestedMode) {
  $active = $State.Active; $completedForPrepare = $active.state -eq "completed_pending_review" -and $RequestedMode -eq "Prepare"
  switch ($active.state) {
    "awaiting_pack" { Stop-Code "MISSING_SOURCE" "The selected phase pack is absent." }
    "awaiting_human_approval" { Stop-Code "HUMAN_APPROVAL_REQUIRED" "The selected phase is not approved." }
    "paused" { Stop-Code "PHASE_PAUSED" "The selected phase is paused." }
    "completed_pending_review" { if (-not $completedForPrepare) { Stop-Code "SPEC_CONFLICT" "The active phase is already complete." } }
    "ready" { }
    default { Stop-Code "SPEC_CONFLICT" "Unknown active-phase state '$($active.state)'." }
  }
  if (-not $completedForPrepare -and ($active.human_approved -ne $true -or [string]::IsNullOrWhiteSpace([string]$active.pack_version))) { Stop-Code "HUMAN_APPROVAL_REQUIRED" "A ready phase requires approval and pack_version." }
  $packRel = Path-Normal ([string]$active.pack_path); $packPath = Join-Path $script:Repo $packRel
  foreach ($name in @("README.md","manifest.json","EXPECTED_SHA256.json","payload")) { if (-not (Test-Path -LiteralPath (Join-Path $packPath $name))) { Stop-Code "MISSING_SOURCE" "Phase pack is missing '$name'." } }
  $manifest = Read-Json "$packRel/manifest.json" "phase manifest"
  foreach ($name in @("schema_version","phase","pack_version","baseline_commit","allowed_target_files","required_validation_commands","expected_results","allows_migration","allows_network")) { Need $manifest $name "phase manifest" }
  if ($manifest.schema_version -ne "matchpulse-phase-pack-v1" -or $manifest.phase -ne $active.phase_id -or $manifest.pack_version -ne $active.pack_version -or $manifest.baseline_commit -ne $active.baseline_commit) { Stop-Code "SPEC_CONFLICT" "Phase manifest identity mismatch." }
  $allowed = @($manifest.allowed_target_files | ForEach-Object { Path-Normal ([string]$_) } | Sort-Object -Unique)
  if ($allowed.Count -eq 0 -or $allowed.Count -ne @($manifest.allowed_target_files).Count -or @($manifest.required_validation_commands).Count -eq 0 -or @($manifest.expected_results).Count -eq 0) { Stop-Code "SPEC_CONFLICT" "Manifest allowlist, commands, and expected results must be nonempty and unique where applicable." }
  $readme = Get-Content -LiteralPath (Join-Path $packPath "README.md") -Raw
  if ($readme -notmatch "(?i)rollback" -or $readme -notmatch "(?i)degraded") { Stop-Code "SPEC_CONFLICT" "Phase pack must declare rollback and degraded behavior." }
  Test-PayloadHashes $packRel
  [pscustomobject]@{ Manifest=$manifest; PackRel=$packRel; Allowed=$allowed }
}
function Require-Main-And-Fetch {
  if (((Invoke-SafeGit @("rev-parse","--is-inside-work-tree")).Lines -join "").Trim() -ne "true") { Stop-Code "SPEC_CONFLICT" "RepoRoot is not a Git repository." }
  $branch = ((Invoke-SafeGit @("branch","--show-current")).Lines -join "").Trim(); if ($branch -ne "main") { Stop-Code "WRONG_BRANCH" "Current branch is '$branch'; expected main." }
  Invoke-SafeGit @("fetch","--prune","origin","main") | Out-Null
}
function Git-Value([string[]]$GitArgs) { ((Invoke-SafeGit $GitArgs).Lines -join "").Trim() }
function Status-All { @((Invoke-SafeGit @("status","--porcelain=v1","--untracked-files=all")).Lines | Where-Object { $_ } | Sort-Object) }
function Status-For($Paths) { $lines=@(); foreach($path in @($Paths|Sort-Object -Unique)){ $lines += @((Invoke-SafeGit @("status","--porcelain=v1","--untracked-files=all","--",$path)).Lines|Where-Object{$_}) }; @($lines|Sort-Object -Unique) }
function Status-Unrelated($State,$Pack) { $phase=Status-For @($Pack.Allowed+$State.ActiveRel); @(Status-All|Where-Object{$phase -notcontains $_}|Sort-Object) }
function Status-Path([string]$line) { if($line.Length-lt 4){Stop-Code "SPEC_CONFLICT" "Invalid git status line."}; $raw=$line.Substring(3); if($raw.Contains(" -> ")){$raw=$raw.Split(@(" -> "),[StringSplitOptions]::None)[-1]}; if($raw.StartsWith('"')){$raw=$raw|ConvertFrom-Json}; Path-Normal $raw }
function Fingerprint-Unrelated($State,$Pack) { @((Status-Unrelated $State $Pack)|ForEach-Object{ $p=Status-Path $_; $f=Join-Path $script:Repo $p; [pscustomobject]@{status=$_;path=$p;length=$(if(Test-Path $f -PathType Leaf){(Get-Item $f).Length}else{$null});worktree_sha256=$(if(Test-Path $f -PathType Leaf){(Get-FileHash $f -Algorithm SHA256).Hash.ToLowerInvariant()}else{$null});index_object=$(((Invoke-SafeGit @("rev-parse",":$p") -AllowFailure).Lines-join"").Trim())} }|Sort-Object path,status) }
function Fingerprint-Json($Value) { @($Value)|ConvertTo-Json -Depth 6 -Compress }

function Validate($State,$Pack) {
  Require-Main-And-Fetch; $head=Git-Value @("rev-parse","HEAD"); $origin=Git-Value @("rev-parse","origin/main")
  if($head-ne$origin){ $base=Git-Value @("merge-base","HEAD","origin/main"); if($base-ne$head){Stop-Code "NON_FAST_FORWARD" "Local main is ahead or diverged."}; Invoke-SafeGit @("merge","--ff-only","origin/main")|Out-Null; $head=Git-Value @("rev-parse","HEAD"); $origin=Git-Value @("rev-parse","origin/main") }
  if((Invoke-SafeGit @("merge-base","--is-ancestor",$State.Active.baseline_commit,"HEAD") -AllowFailure).Code-ne 0){Stop-Code "SPEC_CONFLICT" "Pack baseline is not an ancestor of HEAD."}
  foreach($path in @($State.ActiveRel,$State.QueueRel,$State.EntryRel,$Pack.PackRel)){if((Invoke-SafeGit @("ls-files","--error-unmatch","--",$path) -AllowFailure).Code-ne 0 -or (Status-For @($path)).Count-gt 0){Stop-Code "WORKSPACE_COLLISION" "Governance source is untracked or changed: $path"}}
  foreach($path in $Pack.Allowed){if((Status-For @($path)).Count-gt 0){Stop-Code "WORKSPACE_COLLISION" "Allowed target is already changed: $path"};if((Invoke-SafeGit @("diff","--quiet","$($State.Active.baseline_commit)..HEAD","--",$path) -AllowFailure).Code-ne 0){Stop-Code "SPEC_CONFLICT" "Allowed target changed after the pack baseline: $path"}}
  [ordered]@{schema_version="matchpulse-codex-automation-snapshot-v2";head=$head;origin_main=$origin;phase_id=$State.Active.phase_id;pack_version=$State.Active.pack_version;allowed_targets=@($Pack.Allowed);unrelated_fingerprints=@(Fingerprint-Unrelated $State $Pack);created_at=[DateTime]::UtcNow.ToString("o")}|ConvertTo-Json -Depth 8|Set-Content $script:Snapshot -Encoding utf8
  Write-Host "AUTOMATION_V2_VALIDATED"; Write-Host "HEAD: $head"
}
function Prepare($State,$Pack) {
  Require-Main-And-Fetch; if(-not(Test-Path $script:Snapshot)){Stop-Code "MISSING_VALIDATION_SNAPSHOT" "Run Validate before implementation."}; $snapshot=Get-Content $script:Snapshot -Raw|ConvertFrom-Json
  if($snapshot.schema_version-ne"matchpulse-codex-automation-snapshot-v2"-or$snapshot.phase_id-ne$State.Active.phase_id-or$snapshot.pack_version-ne$State.Active.pack_version){Stop-Code "SPEC_CONFLICT" "Snapshot does not match the active phase."}
  Same-List @($snapshot.allowed_targets|Sort-Object) @($Pack.Allowed|Sort-Object) "SPEC_CONFLICT" "Allowlist changed after Validate."; $head=Git-Value @("rev-parse","HEAD");$origin=Git-Value @("rev-parse","origin/main")
  if($head-ne$snapshot.head-or$origin-ne$snapshot.origin_main-or$head-ne$origin){Stop-Code "NON_FAST_FORWARD" "HEAD or origin/main changed after Validate."}
  foreach($path in @($State.QueueRel,$State.EntryRel,$Pack.PackRel)){if((Status-For @($path)).Count-gt 0){Stop-Code "WORKSPACE_COLLISION" "Protected governance source changed: $path"}}
  if((Fingerprint-Json @($snapshot.unrelated_fingerprints))-cne(Fingerprint-Json @(Fingerprint-Unrelated $State $Pack))){Stop-Code "UNRELATED_WORK_CHANGED" "Unrelated local work changed during execution."}
  $candidate=@($Pack.Allowed+$State.ActiveRel|Sort-Object -Unique);$changed=@($candidate|Where-Object{(Status-For @($_)).Count-gt 0}|Sort-Object -Unique)
  if($changed.Count-eq 0){Stop-Code "NOTHING_TO_COMMIT" "No phase changes exist."};if($changed-notcontains$State.ActiveRel){Stop-Code "SPEC_CONFLICT" "ACTIVE_PHASE.json completion metadata is missing."}
  $done=Get-Content $State.ActivePath -Raw|ConvertFrom-Json;if($done.state-ne"completed_pending_review"-or$done.human_approved-ne$false-or$done.last_result.status-ne"PHASE_COMPLETE"){Stop-Code "SPEC_CONFLICT" "Invalid completion transition."}
  if($done.phase_id-ne$State.Active.phase_id-or$done.pack_version-ne$State.Active.pack_version-or$done.baseline_commit-ne$State.Active.baseline_commit){Stop-Code "SPEC_CONFLICT" "Immutable phase identity changed."}
  $declared=@($done.last_result.files_changed|ForEach-Object{Path-Normal ([string]$_)}|Sort-Object -Unique);$actual=@($changed|Where-Object{$_-ne$State.ActiveRel}|Sort-Object -Unique);Same-List $declared $actual "SPEC_CONFLICT" "last_result.files_changed does not match the actual phase diff."
  Invoke-SafeGit (@("diff","--check","--")+$changed)|Out-Null;foreach($path in $changed){Invoke-SafeGit @("add","--",$path)|Out-Null};$staged=@((Invoke-SafeGit @("diff","--cached","--name-only")).Lines|Where-Object{$_}|ForEach-Object{Path-Normal $_}|Sort-Object -Unique);Same-List $changed $staged "STAGING_SCOPE_VIOLATION" "Staged files differ from the exact phase diff."
  Invoke-SafeGit @("commit","-m","Complete Phase $($State.Active.phase_id) $($State.Active.phase_title.ToLowerInvariant())")|Out-Null;if((Git-Value @("rev-parse","HEAD^1"))-ne$origin){Stop-Code "NON_FAST_FORWARD" "Prepared commit parent is not origin/main."};Write-Host "AUTOMATION_V2_PREPARED";Write-Host "Unrelated local work remains byte-identical and unstaged."
}
function Require-True($Object,[string]$Name,[string]$Context){Need $Object $Name $Context;if($Object.$Name-ne$true){Stop-Code "PROGRAM_POLICY_REJECTED" "$Context requires $Name=true."}}
function Assert-Completion-Evidence($Active,$Manifest) {
  $r=$Active.last_result; foreach($n in @("files_changed","validation_evidence","network_accessed","shared_or_remote_database_mutated","secret_used_or_exposed","remote_deployment_or_irreversible_operation","migration_applied")){Need $r $n "last_result"}
  if(@($r.validation_evidence).Count-lt@($Manifest.required_validation_commands).Count){Stop-Code "VALIDATION_EVIDENCE_MISSING" "Not every required validation has evidence."}
  foreach($e in @($r.validation_evidence)){if($e -is [string]){if([string]::IsNullOrWhiteSpace($e)){Stop-Code "VALIDATION_EVIDENCE_MISSING" "Empty validation evidence."}}else{Need $e "status" "validation evidence";if($e.status-notin@("passed","PASS","success")){Stop-Code "VALIDATION_EVIDENCE_MISSING" "A required validation did not pass."}}}
  if($r.network_accessed-ne$false-or$r.shared_or_remote_database_mutated-ne$false-or$r.secret_used_or_exposed-ne$false-or$r.remote_deployment_or_irreversible_operation-ne$false){Stop-Code "PROGRAM_POLICY_REJECTED" "Completion evidence records a prohibited external, secret, database, deployment, or irreversible action."}
  if($r.migration_applied-eq$true){if($Manifest.allows_migration-ne$true){Stop-Code "PROGRAM_POLICY_REJECTED" "Migration was not explicitly allowed."};Need $r "migration_safety_checks" "last_result";foreach($check in @("schema validation","migration diff","migration test","data-integrity verification","rollback or forward-fix instructions")){if(@($r.migration_safety_checks)-notcontains$check){Stop-Code "VALIDATION_EVIDENCE_MISSING" "Missing migration safety check: $check"}}}
}
function Publish($State,$Pack) {
  Require-Main-And-Fetch;if($State.Active.state-ne"completed_pending_review"-or$State.Active.last_result.status-ne"PHASE_COMPLETE"){Stop-Code "SPEC_CONFLICT" "Publish requires committed completion metadata."};if(@((Invoke-SafeGit @("diff","--cached","--name-only")).Lines|Where-Object{$_}).Count-gt 0){Stop-Code "STAGING_SCOPE_VIOLATION" "Publish requires an empty index."}
  $program=Read-Program;$programEnabled=$program.program_mode.enabled-eq$true
  if($programEnabled){Require-True $State.Active.execution "allow_automatic_publish_after_prepare" "active execution";Need $Pack.Manifest "git_publish" "phase manifest";Require-True $Pack.Manifest.git_publish "allow_push" "manifest git_publish";Require-True $Pack.Manifest.git_publish "safe_auto_publish" "manifest git_publish";Require-True $Pack.Manifest.git_publish "require_program_policy_conditions" "manifest git_publish";Require-True $program.program_mode "auto_publish_low_risk_phases" "program mode";foreach($n in @("all_required_validations_pass","changed_paths_limited_to_active_allowlist_and_permitted_completion_metadata","origin_main_must_equal_validated_baseline","fast_forward_safe_required","manifest_must_allow_publish","program_policy_must_be_enabled")){Require-True $program.safe_auto_publication_policy $n "safe auto-publication policy"};Assert-Completion-Evidence $State.Active $Pack.Manifest}
  $origin=Git-Value @("rev-parse","origin/main");$parent=Git-Value @("rev-parse","HEAD^1");$ahead=[int](Git-Value @("rev-list","--count","origin/main..HEAD"));if($parent-ne$origin-or$ahead-ne1){Stop-Code "NON_FAST_FORWARD" "Expected exactly one prepared commit above origin/main."}
  $declared=@($State.Active.last_result.files_changed|ForEach-Object{Path-Normal $_}|Sort-Object -Unique);$expected=@($declared+$State.ActiveRel|Sort-Object -Unique);$actual=@((Invoke-SafeGit @("diff-tree","--no-commit-id","--name-only","-r","HEAD")).Lines|Where-Object{$_}|ForEach-Object{Path-Normal $_}|Sort-Object -Unique);Same-List $expected $actual "STAGING_SCOPE_VIOLATION" "Prepared commit contains unauthorized files."
  Invoke-SafeGit @("push","origin","HEAD:main")|Out-Null;Invoke-SafeGit @("fetch","origin","main")|Out-Null;if((Git-Value @("rev-parse","HEAD"))-ne(Git-Value @("rev-parse","origin/main"))){Stop-Code "REMOTE_VERIFICATION_FAILED" "Local HEAD differs from origin/main after publication."};if($programEnabled){Write-Host "AUTOMATION_V2_PROGRAM_PUBLISHED"}else{Write-Host "AUTOMATION_V2_PUBLISHED"};Write-Host "Unrelated local work remains preserved."
}
function Find-Successor($Program,$Queue) {
  $dependencyBlocked = @(); $gateBlocked = @(); $remaining = 0
  foreach($phase in @($Program.phases)){
    $q=@($Queue.items|Where-Object{$_.id-eq$phase.id});if($q.Count-ne1){Stop-Code "SPEC_CONFLICT" "Program phase $($phase.id) must occur exactly once in the queue."};if($q[0].status-eq"completed"-or$phase.status-in@("deferred","deferred_not_required","not_required")-or$phase.required_for_program_complete-eq$false){continue}
    $remaining++; $depsOk=$true
    foreach($dep in @($phase.dependencies)){if(@($Queue.items|Where-Object{$_.id-eq$dep-and$_.status-eq"completed"}).Count-ne1){$depsOk=$false}}
    if(-not$depsOk){$dependencyBlocked += $phase.id;continue}
    $gatesOk=$true
    foreach($gate in @($phase.gates)){ $planGate=@($Program.technical_gates|Where-Object{$_.id-eq$gate});$res=@($script:GateRes.gate_resolutions|Where-Object{$_.gate_id-eq$gate});if($planGate.Count-ne1-or$res.Count-ne1-or[string]$planGate[0].resolution-match"unresolved"-or[string]$res[0].status-match"unresolved|pending|blocked"){$gatesOk=$false} }
    if(-not$gatesOk){$gateBlocked += $phase.id;continue}
    return $phase
  }
  if($gateBlocked.Count-gt0){Stop-Code "UNRESOLVED_GATE" "No successor is eligible; unresolved gates block: $($gateBlocked -join ', ')."}
  if($dependencyBlocked.Count-gt0){Stop-Code "INCOMPLETE_DEPENDENCY" "No successor is eligible; incomplete dependencies block: $($dependencyBlocked -join ', ')."}
  if($remaining-gt0){Stop-Code "SPEC_CONFLICT" "No deterministic successor is eligible."};$null
}
function ProgramTransition {
  Require-Main-And-Fetch;$origin=Git-Value @("rev-parse","origin/main");if((Git-Value @("rev-parse","HEAD"))-ne$origin){Stop-Code "NON_FAST_FORWARD" "ProgramTransition requires HEAD equal origin/main."}
  $program=Read-Program;if($program.program_mode.enabled-ne$true){Stop-Code "PROGRAM_MODE_DISABLED" "Program mode is not enabled."};if($program.program_mode.max_parallel_phases-ne1){Stop-Code "SPEC_CONFLICT" "Maximum parallel phases must be one."}
  $committedActive=(git -C $script:Repo show "HEAD:docs/codex-master-plan/ACTIVE_PHASE.json"|ConvertFrom-Json);$committedQueue=(git -C $script:Repo show "HEAD:docs/codex-master-plan/PHASE_QUEUE.json"|ConvertFrom-Json)
  if($committedActive.state-ne"completed_pending_review"-or$committedActive.last_result.status-ne"PHASE_COMPLETE"-or$committedQueue.active_phase_id-ne$committedActive.phase_id-or@($committedQueue.items|Where-Object{$_.id-eq$committedActive.phase_id}).Count-ne1){Stop-Code "SPEC_CONFLICT" "Published phase identity or completion state is invalid."}
  # The queue is deliberately updated only by this transition. For deterministic
  # selection, the committed ACTIVE_PHASE completion is authoritative for the
  # just-published phase while all earlier completion states come from the queue.
  ($committedQueue.items | Where-Object { $_.id -eq $committedActive.phase_id }).status = "completed"
  $script:GateRes=Read-Json "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json" "gate resolutions";$next=Find-Successor $program $committedQueue;if($null-eq$next){Write-Host "PROGRAM_COMPLETE";return};Write-Host "DETERMINISTIC_NEXT_PHASE: $($next.id)"
  $state=Read-State;if($state.Active.phase_id-ne$next.id-or$state.Queue.active_phase_id-ne$next.id){Stop-Code "WRONG_SUCCESSOR" "Prepared transition must select deterministic successor $($next.id)."}
  $old=@($state.Queue.items|Where-Object{$_.id-eq$committedActive.phase_id});if($old.Count-ne1-or$old[0].status-ne"completed"-or$old[0].completion_commit-ne$origin){Stop-Code "SPEC_CONFLICT" "Queue does not record the published phase and completion commit."}
  if($state.Active.state-ne"ready"-or$state.Active.human_approved-ne$true-or$null-ne$state.Active.last_result){Stop-Code "SPEC_CONFLICT" "Successor must be ready, governance-approved, and have null last_result."}
  $packRel=Path-Normal ([string]$state.Active.pack_path);if(-not(Test-Path (Join-Path $script:Repo "$packRel/manifest.json"))){Stop-Code "MISSING_SUCCESSOR_PACK" "Exact next phase $($next.id) has no complete pack; author it only from repository-authorized architecture sources."};$pack=Read-Pack $state "Validate";Need $pack.Manifest "git_publish" "successor phase manifest";if($state.Active.baseline_commit-ne$origin){Stop-Code "SPEC_CONFLICT" "Successor baseline must equal current origin/main."}
  $changed=@(Status-All|ForEach-Object{Status-Path $_}|Sort-Object -Unique);$allowed=@($state.ActiveRel,$state.QueueRel);$prefix="$packRel/";foreach($p in $changed){if($p-ne$state.ActiveRel-and$p-ne$state.QueueRel-and-not$p.StartsWith($prefix,[StringComparison]::Ordinal)){Stop-Code "STAGING_SCOPE_VIOLATION" "Unauthorized transition path: $p"};if($p-match "(^|/)(apps|packages|prisma|migrations|node_modules)/|(^|/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|\.env($|\.)|\.github/workflows/)" ){Stop-Code "STAGING_SCOPE_VIOLATION" "Forbidden transition path: $p"}}
  if($changed-notcontains$state.ActiveRel-or$changed-notcontains$state.QueueRel){Stop-Code "SPEC_CONFLICT" "Transition state files are incomplete."};Invoke-SafeGit (@("diff","--check","--")+$changed)|Out-Null;foreach($p in $changed){Invoke-SafeGit @("add","--",$p)|Out-Null};$staged=@((Invoke-SafeGit @("diff","--cached","--name-only")).Lines|Where-Object{$_}|ForEach-Object{Path-Normal $_}|Sort-Object -Unique);Same-List $changed $staged "STAGING_SCOPE_VIOLATION" "Transition staging is not exact."
  Invoke-SafeGit @("commit","-m","Activate Phase $($next.id) under continuous program")|Out-Null;if((Git-Value @("rev-parse","HEAD^1"))-ne$origin){Stop-Code "NON_FAST_FORWARD" "Transition parent is not the published origin/main."};Invoke-SafeGit @("push","origin","HEAD:main")|Out-Null;Invoke-SafeGit @("fetch","origin","main")|Out-Null;if((Git-Value @("rev-parse","HEAD"))-ne(Git-Value @("rev-parse","origin/main"))){Stop-Code "REMOTE_VERIFICATION_FAILED" "Transition did not reach origin/main exactly."};Write-Host "AUTOMATION_V2_PROGRAM_TRANSITIONED"
}

try{$script:Repo=(Resolve-Path -LiteralPath $RepoRoot).Path}catch{Stop-Code "SPEC_CONFLICT" "Repository root does not exist: $RepoRoot"};$script:Snapshot=Join-Path $script:Repo ".git/codex-automation-v2-snapshot.json"
if($Mode-eq"ProgramTransition"){ProgramTransition;exit 0};$state=Read-State
if($Mode-eq"Publish"){$pack=Read-Pack $state "Prepare";Publish $state $pack;exit 0};$pack=Read-Pack $state $Mode;if($Mode-eq"Prepare"){Prepare $state $pack;exit 0};Validate $state $pack
$program=Read-Program;if($program.program_mode.enabled-eq$true){$prompt="Work directly inside $script:Repo. Read AGENTS.md and $($state.EntryRel). Run Automation v2 Validate, execute and Prepare the exact active phase, safely Publish when manifest and program policy authorize it, verify remote publication, author only the deterministic next pack from authorized sources when missing, run ProgramTransition, and continue the enabled program."}else{$prompt="Work directly inside $script:Repo. Read AGENTS.md and $($state.EntryRel). Run Automation v2 Validate, execute only the repository-selected active phase and all pack validations, update only permitted completion metadata, then run Automation v2 Prepare. Stop before Publish and never activate the next phase."};if($CopyPrompt){try{Set-Clipboard $prompt}catch{Write-Warning "Clipboard copy failed."}};Write-Host $prompt

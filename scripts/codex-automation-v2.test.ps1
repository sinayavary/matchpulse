$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "codex-automation-v2.ps1"
$shell = (Get-Process -Id $PID).Path
$root = Join-Path ([IO.Path]::GetTempPath()) ("matchpulse-automation-v2-" + [guid]::NewGuid().ToString("N"))
$script:passed = 0
$script:failed = 0
$gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
if ($null -eq $gitCommand) { Write-Error "MISSING_GIT: Git is required to run Automation v2 tests."; exit 1 }
$git = $gitCommand.Source

function Invoke-TestGit([string]$Repo, [Parameter(ValueFromRemainingArguments=$true)][string[]]$Args) {
  $prior = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  & $git -C $Repo @Args 2>&1 | Out-Null; $code = $LASTEXITCODE
  $ErrorActionPreference = $prior
  if ($code -ne 0) { throw "git $($Args -join ' ') failed" }
}
function Write-Utf8([string]$Path, [string]$Text) {
  $parent = Split-Path $Path -Parent
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}
function Json($Value) { $Value | ConvertTo-Json -Depth 20 }
function New-Pack([string]$Repo, [string]$Id, [string]$Baseline, [bool]$Safe=$true) {
  $rel = "docs/codex-master-plan/phases/phase-$($Id.ToLowerInvariant())"; $dir = Join-Path $Repo $rel
  New-Item -ItemType Directory -Force -Path (Join-Path $dir "payload") | Out-Null
  Write-Utf8 (Join-Path $dir "README.md") "# $Id`nRollback: revert the phase commit. Degraded behavior: retain the prior implementation.`n"
  Write-Utf8 (Join-Path $dir "payload/target.txt") "$Id payload`n"
  $hash = (Get-FileHash (Join-Path $dir "payload/target.txt") -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Utf8 (Join-Path $dir "EXPECTED_SHA256.json") (Json ([ordered]@{schema_version="matchpulse-payload-integrity-v2";files=[ordered]@{"target.txt"=$hash}}))
  $manifest=[ordered]@{schema_version="matchpulse-phase-pack-v1";phase=$Id;pack_version="$Id-v1";baseline_commit=$Baseline;allowed_target_files=@("target.txt");required_validation_commands=@("test-command");expected_results=@("pass");allows_migration=$false;allows_network=$false;git_publish=[ordered]@{allow_push=$true;safe_auto_publish=$Safe;require_program_policy_conditions=$true}}
  Write-Utf8 (Join-Path $dir "manifest.json") (Json $manifest)
  $rel
}
function New-Fixture([bool]$ProgramEnabled=$false, [bool]$Safe=$true) {
  $name=[guid]::NewGuid().ToString("N");$remote=Join-Path $root "$name.git";$repo=Join-Path $root $name
  & git init --bare $remote 2>&1|Out-Null;& git init -b main $repo 2>&1|Out-Null
  Invoke-TestGit $repo config user.email test@example.invalid;Invoke-TestGit $repo config user.name "Automation Test";Invoke-TestGit $repo remote add origin $remote
  Write-Utf8 (Join-Path $repo "seed.txt") "seed`n";Invoke-TestGit $repo add -- seed.txt;Invoke-TestGit $repo commit -m seed
  $baseline=(& git -C $repo rev-parse HEAD).Trim();$pack=New-Pack $repo "A" $baseline $Safe
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/CODEX_ENTRYPOINT.md") "entry`n"
  $gateIds=@("GATE_DB_LOCAL","GATE_PUBLIC_SAFE_API","GATE_LOCAL_INTEGRATION","GATE_LOCAL_RELEASE")
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json") (Json ([ordered]@{gate_resolutions=@($gateIds|ForEach-Object{[ordered]@{gate_id=$_;canonical=$true;status="approved"}});legacy_gate_aliases=@([ordered]@{legacy_id="GATE_DB_DEV";canonical_id="GATE_DB_LOCAL";authoritative=$false})}))
  $policy=[ordered]@{all_required_validations_pass=$true;changed_paths_limited_to_active_allowlist_and_permitted_completion_metadata=$true;real_external_service_accessed=$false;shared_or_remote_database_mutated=$false;secret_used_or_exposed=$false;remote_deployment_or_irreversible_operation=$false;origin_main_must_equal_validated_baseline=$true;force_push=$false;fast_forward_safe_required=$true;manifest_must_allow_publish=$true;program_policy_must_be_enabled=$true}
  $program=[ordered]@{schema_version="matchpulse-program-plan-v2";program_mode=[ordered]@{enabled=$ProgramEnabled;auto_publish_low_risk_phases=$true;max_parallel_phases=1};safe_auto_publication_policy=$policy;technical_gates=@($gateIds|ForEach-Object{[ordered]@{id=$_}});phases=@([ordered]@{id="A";dependencies=@();gates=@()},[ordered]@{id="B";dependencies=@("A");gates=@()},[ordered]@{id="C";dependencies=@("B");gates=@()})}
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/PROGRAM_PLAN.json") (Json $program)
  $active=[ordered]@{schema_version="matchpulse-active-phase-v1";project="MatchPulse";state="ready";phase_id="A";phase_title="Alpha";pack_path=$pack;pack_version="A-v1";baseline_commit=$baseline;human_approved=$true;execution=[ordered]@{allow_automatic_publish_after_prepare=$true};last_result=$null}
  $queue=[ordered]@{schema_version="matchpulse-phase-queue-v1";project="MatchPulse";active_phase_id="A";items=@([ordered]@{id="A";status="ready"},[ordered]@{id="B";status="planned"},[ordered]@{id="C";status="planned"})}
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/ACTIVE_PHASE.json") (Json $active);Write-Utf8 (Join-Path $repo "docs/codex-master-plan/PHASE_QUEUE.json") (Json $queue)
  Invoke-TestGit $repo add -- docs;Invoke-TestGit $repo commit -m governance;Invoke-TestGit $repo push -u origin main
  [pscustomobject]@{Repo=$repo;Remote=$remote;Baseline=$baseline}
}
function Run([string]$Repo,[string]$Mode) {
  $prior=$ErrorActionPreference;$ErrorActionPreference="Continue";$out=@(& $shell -NoProfile -ExecutionPolicy Bypass -File $runner -RepoRoot $Repo -Mode $Mode 2>&1);$code=$LASTEXITCODE;$ErrorActionPreference=$prior;[pscustomobject]@{Code=$code;Text=($out-join"`n")}
}
function Complete([string]$Repo,[bool]$Network=$false) {
  Write-Utf8 (Join-Path $Repo "target.txt") "implemented`n"
  $p=Join-Path $Repo "docs/codex-master-plan/ACTIVE_PHASE.json";$a=Get-Content $p -Raw|ConvertFrom-Json;$a.state="completed_pending_review";$a.human_approved=$false
  $a.last_result=[ordered]@{status="PHASE_COMPLETE";files_changed=@("target.txt");validation_evidence=@([ordered]@{command="test-command";status="passed"});network_accessed=$Network;shared_or_remote_database_mutated=$false;secret_used_or_exposed=$false;remote_deployment_or_irreversible_operation=$false;migration_applied=$false}
  Write-Utf8 $p (Json $a)
}
function Prepared([bool]$Program=$false,[bool]$Safe=$true,[bool]$Network=$false) { $f=New-Fixture $Program $Safe; $null=Run $f.Repo Validate; Complete $f.Repo $Network; $r=Run $f.Repo Prepare; if($r.Code-ne0){throw $r.Text};$f }
function Test([string]$Name,[scriptblock]$Body) { try{&$Body;$script:passed++;Write-Host "PASS $Name"}catch{$script:failed++;Write-Host "FAIL $Name`: $($_.Exception.Message)"} }
function Must-Pass($r,[string]$Code){if($r.Code-ne0-or$r.Text-notmatch[regex]::Escape($Code)){throw $r.Text}}
function Must-Fail($r,[string]$Code){if($r.Code-eq0-or$r.Text-notmatch[regex]::Escape($Code)){throw "Expected $Code, got: $($r.Text)"}}
function Prepare-Transition($f,[string]$Selected="B",[bool]$Pack=$true) {
  $origin=(&git -C $f.Repo rev-parse origin/main).Trim();$aPath=Join-Path $f.Repo "docs/codex-master-plan/ACTIVE_PHASE.json";$qPath=Join-Path $f.Repo "docs/codex-master-plan/PHASE_QUEUE.json"
  $q=Get-Content $qPath -Raw|ConvertFrom-Json;($q.items|Where-Object id -eq A).status="completed";($q.items|Where-Object id -eq A)|Add-Member -NotePropertyName completion_commit -NotePropertyValue $origin -Force;$q.active_phase_id=$Selected;($q.items|Where-Object id -eq $Selected).status="ready";Write-Utf8 $qPath (Json $q)
  $rel="docs/codex-master-plan/phases/phase-$($Selected.ToLowerInvariant())";if($Pack){$rel=New-Pack $f.Repo $Selected $origin}
  $a=[ordered]@{schema_version="matchpulse-active-phase-v1";project="MatchPulse";state="ready";phase_id=$Selected;phase_title=$Selected;pack_path=$rel;pack_version="$Selected-v1";baseline_commit=$origin;human_approved=$true;execution=[ordered]@{allow_automatic_publish_after_prepare=$true};last_result=$null};Write-Utf8 $aPath (Json $a)
}
function Set-PhaseGate($f,[string]$Gate,[string]$Status="approved",[bool]$Duplicate=$false) {
  $p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$program=Get-Content $p -Raw|ConvertFrom-Json;($program.phases|Where-Object id -eq B).gates=@($Gate);Write-Utf8 $p (Json $program)
  $r=Join-Path $f.Repo "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json";$res=Get-Content $r -Raw|ConvertFrom-Json;$match=$res.gate_resolutions|Where-Object gate_id -eq $Gate;if($match){$match.status=$Status;if($Duplicate){$res.gate_resolutions=@($res.gate_resolutions)+@([ordered]@{gate_id=$Gate;canonical=$true;status="approved"})}};Write-Utf8 $r (Json $res)
  Invoke-TestGit $f.Repo add -- $p $r;Invoke-TestGit $f.Repo commit -m gate;Invoke-TestGit $f.Repo push origin main
}
function Set-DbMigrationDeclarations($f) {
  $p=Join-Path $f.Repo "docs/codex-master-plan/phases/phase-b/manifest.json";$m=Get-Content $p -Raw|ConvertFrom-Json;$m.allows_migration=$true;$m|Add-Member -NotePropertyName migration_database_scope -NotePropertyValue "repository-managed isolated local or ephemeral PostgreSQL 16" -Force;$m|Add-Member -NotePropertyName migration_safety_checks -NotePropertyValue @("schema validation","migration diff","migration test","data-integrity verification","rollback or forward-fix instructions") -Force;Write-Utf8 $p (Json $m)
}

New-Item -ItemType Directory -Force $root|Out-Null
try {
  Test "1 phase-mode Validate succeeds" { $f=New-Fixture;Must-Pass (Run $f.Repo Validate) "AUTOMATION_V2_VALIDATED" }
  Test "2 wrong branch is rejected" { $f=New-Fixture;Invoke-TestGit $f.Repo checkout -b other;Must-Fail (Run $f.Repo Validate) "WRONG_BRANCH" }
  Test "3 phase-mode Prepare creates one exact commit" { $f=New-Fixture;$before=(&git -C $f.Repo rev-list --count HEAD).Trim();$null=Run $f.Repo Validate;Complete $f.Repo;Must-Pass (Run $f.Repo Prepare) "AUTOMATION_V2_PREPARED";$after=(&git -C $f.Repo rev-list --count HEAD).Trim();if(([int]$after-[int]$before)-ne1){throw "commit count"} }
  Test "4 unauthorized staged file is rejected" { $f=New-Fixture;$null=Run $f.Repo Validate;Complete $f.Repo;Write-Utf8 (Join-Path $f.Repo bad.txt) "bad";Invoke-TestGit $f.Repo add -- bad.txt;Must-Fail (Run $f.Repo Prepare) "UNRELATED_WORK_CHANGED" }
  Test "5 phase-mode Publish preserves explicit mode" { $f=Prepared;Must-Pass (Run $f.Repo Publish) "AUTOMATION_V2_PUBLISHED" }
  Test "6 enabled program auto-Publish succeeds" { $f=Prepared $true;Must-Pass (Run $f.Repo Publish) "AUTOMATION_V2_PROGRAM_PUBLISHED" }
  Test "7 safe_auto_publish false is rejected" { $f=Prepared $true $false;Must-Fail (Run $f.Repo Publish) "PROGRAM_POLICY_REJECTED" }
  Test "8 network_accessed true is rejected" { $f=Prepared $true $true $true;Must-Fail (Run $f.Repo Publish) "PROGRAM_POLICY_REJECTED" }
  Test "9 non-fast-forward publication is rejected" { $f=Prepared;$other=Join-Path $root ([guid]::NewGuid().ToString("N"));$prior=$ErrorActionPreference;$ErrorActionPreference="Continue";&git clone -b main $f.Remote $other 2>&1|Out-Null;$ErrorActionPreference=$prior;Invoke-TestGit $other config user.email x@y.invalid;Invoke-TestGit $other config user.name x;Write-Utf8 (Join-Path $other remote.txt) x;Invoke-TestGit $other add -- remote.txt;Invoke-TestGit $other commit -m remote;Invoke-TestGit $other push origin main;Must-Fail (Run $f.Repo Publish) "NON_FAST_FORWARD" }
  Test "10 ProgramTransition selects first eligible" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
  Test "11 caller-selected wrong successor rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "WRONG_SUCCESSOR" }
  Test "12 incomplete dependency is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).dependencies=@("C");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- $p;Invoke-TestGit $f.Repo commit -m plan;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "INCOMPLETE_DEPENDENCY" }
  Test "13 unresolved gate is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "pending";Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNRESOLVED_GATE" }
  Test "14 missing successor pack rejected safely" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f B $false;Must-Fail (Run $f.Repo ProgramTransition) "MISSING_SUCCESSOR_PACK" }
  Test "15 runtime transition file rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;Write-Utf8 (Join-Path $f.Repo "apps/api/src/x.ts") x;Must-Fail (Run $f.Repo ProgramTransition) "STAGING_SCOPE_VIOLATION" }
  Test "16 transition commit contains exact paths" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;$before=(&git -C $f.Repo rev-parse HEAD).Trim();$null=Run $f.Repo ProgramTransition;$names=@(&git -C $f.Repo diff-tree --no-commit-id --name-only -r HEAD);if($names|Where-Object{$_-notmatch'ACTIVE_PHASE|PHASE_QUEUE|phases/phase-b/'}){throw "unauthorized transition commit"};if((&git -C $f.Repo rev-parse HEAD^).Trim()-ne$before){throw "wrong parent"} }
  Test "17 remote equality verified" { $f=Prepared $true;Must-Pass (Run $f.Repo Publish) "PROGRAM_PUBLISHED";if((&git -C $f.Repo rev-parse HEAD).Trim()-ne(&git -C $f.Repo rev-parse origin/main).Trim()){throw "publish equality"};Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "PROGRAM_TRANSITIONED";if((&git -C $f.Repo rev-parse HEAD).Trim()-ne(&git -C $f.Repo rev-parse origin/main).Trim()){throw "transition equality"} }
  Test "18 unrelated work remains unchanged" { $f=New-Fixture;Write-Utf8 (Join-Path $f.Repo unrelated.txt) "keep`n";$hash=(Get-FileHash (Join-Path $f.Repo unrelated.txt)).Hash;$null=Run $f.Repo Validate;Complete $f.Repo;Must-Pass (Run $f.Repo Prepare) "PREPARED";if((Get-FileHash (Join-Path $f.Repo unrelated.txt)).Hash-ne$hash){throw "unrelated content changed"} }
  Test "19 canonical resolved gate transitions" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION";Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
  Test "20 unknown gate ID is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).gates=@("GATE_UNKNOWN");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- $p;Invoke-TestGit $f.Repo commit -m gate;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNKNOWN_GATE" }
  Test "21 legacy alias is rejected as phase gate" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).gates=@("GATE_DB_DEV");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- $p;Invoke-TestGit $f.Repo commit -m gate;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNKNOWN_GATE" }
  Test "22 duplicate canonical resolutions are rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "approved" $true;Prepare-Transition $f;Must-Fail (Run $f.Repo ProgramTransition) "DUPLICATE_CANONICAL_GATE" }
  Test "23 blocked canonical resolution is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "blocked";Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNRESOLVED_GATE" }
  Test "24 DB-local migration pack without safety declarations is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_DB_LOCAL";Prepare-Transition $f;$p=Join-Path $f.Repo "docs/codex-master-plan/phases/phase-b/manifest.json";$m=Get-Content $p -Raw|ConvertFrom-Json;$m.allows_migration=$true;Write-Utf8 $p (Json $m);Must-Fail (Run $f.Repo ProgramTransition) "MIGRATION_APPROVAL_REQUIRED" }
  Test "25 DB-local migration pack with safety declarations transitions" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_DB_LOCAL";Prepare-Transition $f;Set-DbMigrationDeclarations $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
} finally { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "AUTOMATION_V2_TESTS: $script:passed passed, $script:failed failed, $($script:passed+$script:failed) total"
if($script:failed-ne0){exit 1}

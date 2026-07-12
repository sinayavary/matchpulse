param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
)

$ErrorActionPreference = "Stop"

function Write-Utf8([string]$Path, [string]$Content) {
  [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
}

function Replace-Exact([string]$Path, [string]$Old, [string]$New) {
  $content = [IO.File]::ReadAllText($Path)
  if (-not $content.Contains($Old)) {
    throw "SOURCE_DRIFT: expected block not found in $Path"
  }
  Write-Utf8 $Path ($content.Replace($Old, $New))
}

$runnerPath = Join-Path $RepoRoot "scripts/codex-automation-v2.ps1"
$testPath = Join-Path $RepoRoot "scripts/codex-automation-v2.test.ps1"
$ciPath = Join-Path $RepoRoot ".github/workflows/ci.yml"

$oldRunnerHeader = @'
$ErrorActionPreference = "Stop"

function Stop-Code([string]$Code, [string]$Message) { Write-Error "$Code`: $Message"; exit 1 }
function Invoke-SafeGit([string[]]$GitArgs, [switch]$AllowFailure) {
  $prior = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  $output = @(& git -C $script:Repo @GitArgs 2>&1); $code = $LASTEXITCODE
  $ErrorActionPreference = $prior
  if (-not $AllowFailure -and $code -ne 0) { Stop-Code "GIT_OPERATION_FAILED" "git $($GitArgs -join ' ') failed: $($output -join ' ')" }
  [pscustomobject]@{ Code = $code; Lines = $output }
}
'@

$newRunnerHeader = @'
$ErrorActionPreference = "Stop"

function Stop-Code([string]$Code, [string]$Message) { Write-Error "$Code`: $Message"; exit 1 }

function ConvertTo-NativeArgument([string]$Value) {
  if ($null -eq $Value) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  $escaped = $Value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  '"' + $escaped + '"'
}

function Invoke-NativeProcess(
  [string]$FilePath,
  [string[]]$Arguments,
  [string]$WorkingDirectory = $null
) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $FilePath
  $info.Arguments = (@($Arguments) | ForEach-Object { ConvertTo-NativeArgument ([string]$_) }) -join " "
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.CreateNoWindow = $true
  if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    $info.WorkingDirectory = $WorkingDirectory
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  try {
    if (-not $process.Start()) { throw "process did not start" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $exitCode = [int]$process.ExitCode
  } catch {
    Stop-Code "NATIVE_PROCESS_FAILED" "$FilePath failed to start: $($_.Exception.Message)"
  } finally {
    $process.Dispose()
  }

  $combined = @($stdout.TrimEnd(), $stderr.TrimEnd()) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { [string]$_ }

  [pscustomobject]@{
    FilePath = $FilePath
    Arguments = @($Arguments)
    RenderedCommand = "$FilePath $($info.Arguments)"
    ExitCode = $exitCode
    StdOut = $stdout
    StdErr = $stderr
    CombinedOutput = ($combined -join [Environment]::NewLine)
  }
}

$gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
if ($null -eq $gitCommand) { Stop-Code "MISSING_GIT" "Git is required." }
$script:GitExecutable = $gitCommand.Source

function Invoke-SafeGit([string[]]$GitArgs, [switch]$AllowFailure) {
  $result = Invoke-NativeProcess -FilePath $script:GitExecutable -Arguments (@("-C", $script:Repo) + @($GitArgs))
  if (-not $AllowFailure -and $result.ExitCode -ne 0) {
    Stop-Code "GIT_OPERATION_FAILED" "$($result.RenderedCommand) failed with exit $($result.ExitCode). stdout: $($result.StdOut) stderr: $($result.StdErr)"
  }
  [pscustomobject]@{
    Code = $result.ExitCode
    Lines = @($result.StdOut -split "\r?\n" | Where-Object { $_ -ne "" })
    StdOut = $result.StdOut
    StdErr = $result.StdErr
    RenderedCommand = $result.RenderedCommand
  }
}
'@

Replace-Exact $runnerPath $oldRunnerHeader $newRunnerHeader

$oldDirectGit = '$committedActive=(git -C $script:Repo show "HEAD:docs/codex-master-plan/ACTIVE_PHASE.json"|ConvertFrom-Json);$committedQueue=(git -C $script:Repo show "HEAD:docs/codex-master-plan/PHASE_QUEUE.json"|ConvertFrom-Json)'
$newDirectGit = '$committedActive=(Git-Value @("show","HEAD:docs/codex-master-plan/ACTIVE_PHASE.json")|ConvertFrom-Json);$committedQueue=(Git-Value @("show","HEAD:docs/codex-master-plan/PHASE_QUEUE.json")|ConvertFrom-Json)'
Replace-Exact $runnerPath $oldDirectGit $newDirectGit

$test = @'
$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "codex-automation-v2.ps1"
$shell = (Get-Process -Id $PID).Path
$root = Join-Path ([IO.Path]::GetTempPath()) ("matchpulse automation v2 " + [guid]::NewGuid().ToString("N"))
$script:passed = 0
$script:failed = 0
$script:LastNative = $null
$script:LastAutomation = $null
$script:IsWindowsPlatform = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT

function ConvertTo-NativeArgument([string]$Value) {
  if ($null -eq $Value) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  $escaped = $Value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  '"' + $escaped + '"'
}

function Invoke-NativeProcess(
  [string]$FilePath,
  [string[]]$Arguments,
  [string]$WorkingDirectory = $null
) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $FilePath
  $info.Arguments = (@($Arguments) | ForEach-Object { ConvertTo-NativeArgument ([string]$_) }) -join " "
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.CreateNoWindow = $true
  if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) { $info.WorkingDirectory = $WorkingDirectory }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  if (-not $process.Start()) { throw "NATIVE_PROCESS_FAILED: $FilePath did not start." }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  $exitCode = [int]$process.ExitCode
  $process.Dispose()

  $combined = @($stdout.TrimEnd(), $stderr.TrimEnd()) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { [string]$_ }

  [pscustomobject]@{
    FilePath = $FilePath
    Arguments = @($Arguments)
    RenderedCommand = "$FilePath $($info.Arguments)"
    ExitCode = $exitCode
    StdOut = $stdout
    StdErr = $stderr
    CombinedOutput = ($combined -join [Environment]::NewLine)
  }
}

$gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
if ($null -eq $gitCommand) { Write-Error "MISSING_GIT: Git is required to run Automation v2 tests."; exit 1 }
$git = $gitCommand.Source

function Invoke-Git([string[]]$Arguments, [switch]$AllowFailure) {
  $result = Invoke-NativeProcess -FilePath $git -Arguments $Arguments
  $script:LastNative = $result
  if (-not $AllowFailure -and $result.ExitCode -ne 0) {
    throw "GIT_OPERATION_FAILED: $($result.RenderedCommand)`nexit=$($result.ExitCode)`nstdout:`n$($result.StdOut)`nstderr:`n$($result.StdErr)"
  }
  $result
}

function Invoke-TestGit([string]$Repo, [Parameter(ValueFromRemainingArguments=$true)][string[]]$Args) {
  Invoke-Git -Arguments (@("-C", $Repo) + @($Args)) | Out-Null
}

function Git-Text([string]$Repo, [string[]]$Arguments) {
  (Invoke-Git -Arguments (@("-C", $Repo) + @($Arguments))).StdOut.Trim()
}

function Write-Utf8([string]$Path, [string]$Text) {
  $parent = Split-Path $Path -Parent
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function Json($Value) { $Value | ConvertTo-Json -Depth 20 }

function New-Pack([string]$Repo, [string]$Id, [string]$Baseline, [bool]$Safe=$true) {
  $rel = "docs/codex-master-plan/phases/phase-$($Id.ToLowerInvariant())"
  $dir = Join-Path $Repo $rel
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
  $name=[guid]::NewGuid().ToString("N")
  $remote=Join-Path $root "$name remote.git"
  $repo=Join-Path $root "$name repo"
  $hooks=Join-Path $root "$name empty hooks"
  New-Item -ItemType Directory -Force -Path $hooks | Out-Null

  Invoke-Git @("init","--bare",$remote) | Out-Null
  Invoke-Git @("init",$repo) | Out-Null
  Invoke-TestGit $repo branch -M main
  Invoke-TestGit $repo config user.email test@example.invalid
  Invoke-TestGit $repo config user.name "Automation Test"
  Invoke-TestGit $repo config commit.gpgsign false
  Invoke-TestGit $repo config tag.gpgsign false
  Invoke-TestGit $repo config core.hooksPath $hooks
  Invoke-TestGit $repo config protocol.file.allow always
  Invoke-TestGit $repo remote add origin $remote
  Write-Utf8 (Join-Path $repo "seed.txt") "seed`n"
  Invoke-TestGit $repo add -- seed.txt
  Invoke-TestGit $repo commit -m seed
  $baseline=Git-Text $repo @("rev-parse","HEAD")
  $pack=New-Pack $repo "A" $baseline $Safe
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/CODEX_ENTRYPOINT.md") "entry`n"
  $gateIds=@("GATE_DB_LOCAL","GATE_PUBLIC_SAFE_API","GATE_LOCAL_INTEGRATION","GATE_LOCAL_RELEASE")
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json") (Json ([ordered]@{gate_resolutions=@($gateIds|ForEach-Object{[ordered]@{gate_id=$_;canonical=$true;status="approved"}});legacy_gate_aliases=@([ordered]@{legacy_id="GATE_DB_DEV";canonical_id="GATE_DB_LOCAL";authoritative=$false})}))
  $policy=[ordered]@{all_required_validations_pass=$true;changed_paths_limited_to_active_allowlist_and_permitted_completion_metadata=$true;real_external_service_accessed=$false;shared_or_remote_database_mutated=$false;secret_used_or_exposed=$false;remote_deployment_or_irreversible_operation=$false;origin_main_must_equal_validated_baseline=$true;force_push=$false;fast_forward_safe_required=$true;manifest_must_allow_publish=$true;program_policy_must_be_enabled=$true}
  $program=[ordered]@{schema_version="matchpulse-program-plan-v2";program_mode=[ordered]@{enabled=$ProgramEnabled;auto_publish_low_risk_phases=$true;max_parallel_phases=1};safe_auto_publication_policy=$policy;technical_gates=@($gateIds|ForEach-Object{[ordered]@{id=$_}});phases=@([ordered]@{id="A";dependencies=@();gates=@()},[ordered]@{id="B";dependencies=@("A");gates=@()},[ordered]@{id="C";dependencies=@("B");gates=@()})}
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/PROGRAM_PLAN.json") (Json $program)
  $active=[ordered]@{schema_version="matchpulse-active-phase-v1";project="MatchPulse";state="ready";phase_id="A";phase_title="Alpha";pack_path=$pack;pack_version="A-v1";baseline_commit=$baseline;human_approved=$true;execution=[ordered]@{allow_automatic_publish_after_prepare=$true};last_result=$null}
  $queue=[ordered]@{schema_version="matchpulse-phase-queue-v1";project="MatchPulse";active_phase_id="A";items=@([ordered]@{id="A";status="ready"},[ordered]@{id="B";status="planned"},[ordered]@{id="C";status="planned"})}
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/ACTIVE_PHASE.json") (Json $active)
  Write-Utf8 (Join-Path $repo "docs/codex-master-plan/PHASE_QUEUE.json") (Json $queue)
  Invoke-TestGit $repo add -- docs
  Invoke-TestGit $repo commit -m governance
  Invoke-TestGit $repo push -u origin main
  Invoke-Git @("--git-dir",$remote,"symbolic-ref","HEAD","refs/heads/main") | Out-Null
  Invoke-TestGit $repo fetch origin main
  $local=Git-Text $repo @("rev-parse","HEAD")
  $tracking=Git-Text $repo @("rev-parse","origin/main")
  if($local-ne$tracking){throw "fixture origin/main mismatch"}
  [pscustomobject]@{Repo=$repo;Remote=$remote;Baseline=$baseline}
}

function Run([string]$Repo,[string]$Mode) {
  $arguments=@("-NoProfile")
  if($script:IsWindowsPlatform){$arguments+=@("-ExecutionPolicy","Bypass")}
  $arguments+=@("-File",$runner,"-RepoRoot",$Repo,"-Mode",$Mode)
  $result=Invoke-NativeProcess -FilePath $shell -Arguments $arguments
  $script:LastAutomation=$result
  [pscustomobject]@{Code=$result.ExitCode;Text=$result.CombinedOutput;StdOut=$result.StdOut;StdErr=$result.StdErr;Command=$result.RenderedCommand}
}

function Complete([string]$Repo,[bool]$Network=$false) {
  Write-Utf8 (Join-Path $Repo "target.txt") "implemented`n"
  $p=Join-Path $Repo "docs/codex-master-plan/ACTIVE_PHASE.json"
  $a=Get-Content $p -Raw|ConvertFrom-Json
  $a.state="completed_pending_review";$a.human_approved=$false
  $a.last_result=[ordered]@{status="PHASE_COMPLETE";files_changed=@("target.txt");validation_evidence=@([ordered]@{command="test-command";status="passed"});network_accessed=$Network;shared_or_remote_database_mutated=$false;secret_used_or_exposed=$false;remote_deployment_or_irreversible_operation=$false;migration_applied=$false}
  Write-Utf8 $p (Json $a)
}

function Prepared([bool]$Program=$false,[bool]$Safe=$true,[bool]$Network=$false) {
  $f=New-Fixture $Program $Safe
  Must-Pass (Run $f.Repo Validate) "AUTOMATION_V2_VALIDATED"
  Complete $f.Repo $Network
  $r=Run $f.Repo Prepare
  if($r.Code-ne0){throw $r.Text}
  $f
}

function Show-Diagnostics([string]$Name,[System.Management.Automation.ErrorRecord]$ErrorRecord) {
  Write-Host "FAIL $Name"
  Write-Host "Exception: $($ErrorRecord.Exception.Message)"
  Write-Host "Stack: $($ErrorRecord.ScriptStackTrace)"
  Write-Host "PowerShell: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"
  Write-Host "OS: $([Environment]::OSVersion.VersionString)"
  Write-Host "Git: $git"
  $gitVersion=(Invoke-Git @("--version") -AllowFailure)
  Write-Host "Git version: $($gitVersion.CombinedOutput)"
  if($null-ne$script:LastNative){
    Write-Host "Native command: $($script:LastNative.RenderedCommand)"
    Write-Host "Native exit: $($script:LastNative.ExitCode)"
    Write-Host "Native stdout:`n$($script:LastNative.StdOut)"
    Write-Host "Native stderr:`n$($script:LastNative.StdErr)"
  }
  if($null-ne$script:LastAutomation){
    Write-Host "Automation command: $($script:LastAutomation.RenderedCommand)"
    Write-Host "Automation exit: $($script:LastAutomation.ExitCode)"
    Write-Host "Automation stdout:`n$($script:LastAutomation.StdOut)"
    Write-Host "Automation stderr:`n$($script:LastAutomation.StdErr)"
  }
  Write-Host "Fixture root: $root"
}

function Test([string]$Name,[scriptblock]$Body) {
  $script:LastNative=$null;$script:LastAutomation=$null
  try{&$Body;$script:passed++;Write-Host "PASS $Name"}
  catch{$script:failed++;Show-Diagnostics $Name $_}
}

function Must-Pass($r,[string]$Code){if($r.Code-ne0-or$r.Text-notmatch[regex]::Escape($Code)){throw "Expected pass $Code. $($r.Text)"}}
function Must-Fail($r,[string]$Code){if($r.Code-eq0-or$r.Text-notmatch[regex]::Escape($Code)){throw "Expected failure $Code, got exit $($r.Code): $($r.Text)"}}

function Prepare-Transition($f,[string]$Selected="B",[bool]$Pack=$true) {
  $origin=Git-Text $f.Repo @("rev-parse","origin/main")
  $aPath=Join-Path $f.Repo "docs/codex-master-plan/ACTIVE_PHASE.json"
  $qPath=Join-Path $f.Repo "docs/codex-master-plan/PHASE_QUEUE.json"
  $q=Get-Content $qPath -Raw|ConvertFrom-Json
  ($q.items|Where-Object id -eq A).status="completed"
  ($q.items|Where-Object id -eq A)|Add-Member -NotePropertyName completion_commit -NotePropertyValue $origin -Force
  $q.active_phase_id=$Selected
  ($q.items|Where-Object id -eq $Selected).status="ready"
  Write-Utf8 $qPath (Json $q)
  $rel="docs/codex-master-plan/phases/phase-$($Selected.ToLowerInvariant())"
  if($Pack){$rel=New-Pack $f.Repo $Selected $origin}
  $a=[ordered]@{schema_version="matchpulse-active-phase-v1";project="MatchPulse";state="ready";phase_id=$Selected;phase_title=$Selected;pack_path=$rel;pack_version="$Selected-v1";baseline_commit=$origin;human_approved=$true;execution=[ordered]@{allow_automatic_publish_after_prepare=$true};last_result=$null}
  Write-Utf8 $aPath (Json $a)
}

function Set-PhaseGate($f,[string]$Gate,[string]$Status="approved",[bool]$Duplicate=$false) {
  $p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json"
  $program=Get-Content $p -Raw|ConvertFrom-Json
  ($program.phases|Where-Object id -eq B).gates=@($Gate)
  Write-Utf8 $p (Json $program)
  $r=Join-Path $f.Repo "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json"
  $res=Get-Content $r -Raw|ConvertFrom-Json
  $match=$res.gate_resolutions|Where-Object gate_id -eq $Gate
  if($match){$match.status=$Status;if($Duplicate){$res.gate_resolutions=@($res.gate_resolutions)+@([ordered]@{gate_id=$Gate;canonical=$true;status="approved"})}}
  Write-Utf8 $r (Json $res)
  Invoke-TestGit $f.Repo add -- "docs/codex-master-plan/PROGRAM_PLAN.json" "docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json"
  Invoke-TestGit $f.Repo commit -m gate
  Invoke-TestGit $f.Repo push origin main
}

function Set-DbMigrationDeclarations($f) {
  $p=Join-Path $f.Repo "docs/codex-master-plan/phases/phase-b/manifest.json"
  $m=Get-Content $p -Raw|ConvertFrom-Json
  $m.allows_migration=$true
  $m|Add-Member -NotePropertyName migration_database_scope -NotePropertyValue "repository-managed isolated local or ephemeral PostgreSQL 16" -Force
  $m|Add-Member -NotePropertyName migration_safety_checks -NotePropertyValue @("schema validation","migration diff","migration test","data-integrity verification","rollback or forward-fix instructions") -Force
  Write-Utf8 $p (Json $m)
}

New-Item -ItemType Directory -Force $root|Out-Null
Write-Host "PowerShell: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"
Write-Host "OS: $([Environment]::OSVersion.VersionString)"
Write-Host "Git path: $git"
Write-Host "Git version: $((Invoke-Git @("--version")).StdOut.Trim())"

try {
  Test "0 preflight process and repository lifecycle" { $f=New-Fixture;Must-Pass (Run $f.Repo Validate) "AUTOMATION_V2_VALIDATED";if((Git-Text $f.Repo @("rev-parse","HEAD"))-ne(Git-Text $f.Repo @("rev-parse","origin/main"))){throw "preflight remote mismatch"} }
  Test "1 phase-mode Validate succeeds" { $f=New-Fixture;Must-Pass (Run $f.Repo Validate) "AUTOMATION_V2_VALIDATED" }
  Test "2 wrong branch is rejected" { $f=New-Fixture;Invoke-TestGit $f.Repo checkout -b other;Must-Fail (Run $f.Repo Validate) "WRONG_BRANCH" }
  Test "3 phase-mode Prepare creates one exact commit" { $f=New-Fixture;$before=Git-Text $f.Repo @("rev-list","--count","HEAD");$null=Run $f.Repo Validate;Complete $f.Repo;Must-Pass (Run $f.Repo Prepare) "AUTOMATION_V2_PREPARED";$after=Git-Text $f.Repo @("rev-list","--count","HEAD");if(([int]$after-[int]$before)-ne1){throw "commit count"} }
  Test "4 unauthorized staged file is rejected" { $f=New-Fixture;$null=Run $f.Repo Validate;Complete $f.Repo;Write-Utf8 (Join-Path $f.Repo bad.txt) "bad";Invoke-TestGit $f.Repo add -- bad.txt;Must-Fail (Run $f.Repo Prepare) "UNRELATED_WORK_CHANGED" }
  Test "5 phase-mode Publish preserves explicit mode" { $f=Prepared;Must-Pass (Run $f.Repo Publish) "AUTOMATION_V2_PUBLISHED" }
  Test "6 enabled program auto-Publish succeeds" { $f=Prepared $true;Must-Pass (Run $f.Repo Publish) "AUTOMATION_V2_PROGRAM_PUBLISHED" }
  Test "7 safe_auto_publish false is rejected" { $f=Prepared $true $false;Must-Fail (Run $f.Repo Publish) "PROGRAM_POLICY_REJECTED" }
  Test "8 network_accessed true is rejected" { $f=Prepared $true $true $true;Must-Fail (Run $f.Repo Publish) "PROGRAM_POLICY_REJECTED" }
  Test "9 non-fast-forward publication is rejected" { $f=Prepared;$other=Join-Path $root ([guid]::NewGuid().ToString("N")+" clone");Invoke-Git @("-c","protocol.file.allow=always","clone","-b","main",$f.Remote,$other)|Out-Null;Invoke-TestGit $other config user.email x@y.invalid;Invoke-TestGit $other config user.name x;Write-Utf8 (Join-Path $other remote.txt) x;Invoke-TestGit $other add -- remote.txt;Invoke-TestGit $other commit -m remote;Invoke-TestGit $other push origin main;Must-Fail (Run $f.Repo Publish) "NON_FAST_FORWARD" }
  Test "10 ProgramTransition selects first eligible" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
  Test "11 caller-selected wrong successor rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "WRONG_SUCCESSOR" }
  Test "12 incomplete dependency is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).dependencies=@("C");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- "docs/codex-master-plan/PROGRAM_PLAN.json";Invoke-TestGit $f.Repo commit -m plan;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "INCOMPLETE_DEPENDENCY" }
  Test "13 unresolved gate is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "pending";Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNRESOLVED_GATE" }
  Test "14 missing successor pack rejected safely" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f B $false;Must-Fail (Run $f.Repo ProgramTransition) "MISSING_SUCCESSOR_PACK" }
  Test "15 runtime transition file rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;Write-Utf8 (Join-Path $f.Repo "apps/api/src/x.ts") x;Must-Fail (Run $f.Repo ProgramTransition) "STAGING_SCOPE_VIOLATION" }
  Test "16 transition commit contains exact paths" { $f=Prepared $true;$null=Run $f.Repo Publish;Prepare-Transition $f;$before=Git-Text $f.Repo @("rev-parse","HEAD");$null=Run $f.Repo ProgramTransition;$names=(Invoke-Git @("-C",$f.Repo,"diff-tree","--no-commit-id","--name-only","-r","HEAD")).StdOut -split "\r?\n"|Where-Object{$_};if($names|Where-Object{$_-notmatch'ACTIVE_PHASE|PHASE_QUEUE|phases/phase-b/'}){throw "unauthorized transition commit"};if((Git-Text $f.Repo @("rev-parse","HEAD^"))-ne$before){throw "wrong parent"} }
  Test "17 remote equality verified" { $f=Prepared $true;Must-Pass (Run $f.Repo Publish) "PROGRAM_PUBLISHED";if((Git-Text $f.Repo @("rev-parse","HEAD"))-ne(Git-Text $f.Repo @("rev-parse","origin/main"))){throw "publish equality"};Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "PROGRAM_TRANSITIONED";if((Git-Text $f.Repo @("rev-parse","HEAD"))-ne(Git-Text $f.Repo @("rev-parse","origin/main"))){throw "transition equality"} }
  Test "18 unrelated work remains unchanged" { $f=New-Fixture;Write-Utf8 (Join-Path $f.Repo unrelated.txt) "keep`n";$hash=(Get-FileHash (Join-Path $f.Repo unrelated.txt)).Hash;$null=Run $f.Repo Validate;Complete $f.Repo;Must-Pass (Run $f.Repo Prepare) "PREPARED";if((Get-FileHash (Join-Path $f.Repo unrelated.txt)).Hash-ne$hash){throw "unrelated content changed"} }
  Test "19 canonical resolved gate transitions" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION";Prepare-Transition $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
  Test "20 unknown gate ID is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).gates=@("GATE_UNKNOWN");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- "docs/codex-master-plan/PROGRAM_PLAN.json";Invoke-TestGit $f.Repo commit -m gate;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNKNOWN_GATE" }
  Test "21 legacy alias is rejected as phase gate" { $f=Prepared $true;$null=Run $f.Repo Publish;$p=Join-Path $f.Repo "docs/codex-master-plan/PROGRAM_PLAN.json";$x=Get-Content $p -Raw|ConvertFrom-Json;($x.phases|Where-Object id -eq B).gates=@("GATE_DB_DEV");Write-Utf8 $p (Json $x);Invoke-TestGit $f.Repo add -- "docs/codex-master-plan/PROGRAM_PLAN.json";Invoke-TestGit $f.Repo commit -m gate;Invoke-TestGit $f.Repo push origin main;Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNKNOWN_GATE" }
  Test "22 duplicate canonical resolutions are rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "approved" $true;Prepare-Transition $f;Must-Fail (Run $f.Repo ProgramTransition) "DUPLICATE_CANONICAL_GATE" }
  Test "23 blocked canonical resolution is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_LOCAL_INTEGRATION" "blocked";Prepare-Transition $f C;Must-Fail (Run $f.Repo ProgramTransition) "UNRESOLVED_GATE" }
  Test "24 DB-local migration pack without safety declarations is rejected" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_DB_LOCAL";Prepare-Transition $f;$p=Join-Path $f.Repo "docs/codex-master-plan/phases/phase-b/manifest.json";$m=Get-Content $p -Raw|ConvertFrom-Json;$m.allows_migration=$true;Write-Utf8 $p (Json $m);Must-Fail (Run $f.Repo ProgramTransition) "MIGRATION_APPROVAL_REQUIRED" }
  Test "25 DB-local migration pack with safety declarations transitions" { $f=Prepared $true;$null=Run $f.Repo Publish;Set-PhaseGate $f "GATE_DB_LOCAL";Prepare-Transition $f;Set-DbMigrationDeclarations $f;Must-Pass (Run $f.Repo ProgramTransition) "AUTOMATION_V2_PROGRAM_TRANSITIONED" }
} finally {
  if($script:failed-eq0){Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue}
  else{Write-Host "FAILED_FIXTURES_PRESERVED: $root"}
}
Write-Host "AUTOMATION_V2_TESTS: $script:passed passed, $script:failed failed, $($script:passed+$script:failed) total"
if($script:failed-ne0){exit 1}
'@

Write-Utf8 $testPath $test

$ci = @'
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  typecheck:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/matchpulse_ci
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma generate
      - run: pnpm typecheck
      - name: PowerShell and Git diagnostics
        shell: pwsh
        run: |
          $PSVersionTable | Format-List *
          Write-Host "Git path: $((Get-Command git -CommandType Application).Source)"
          git --version
      - name: Automation v2 tests
        shell: pwsh
        run: pwsh -NoProfile -File scripts/codex-automation-v2.test.ps1
'@

Write-Utf8 $ciPath $ci
Write-Host "SOURCE_PACK_APPLIED"
Write-Host "Changed: scripts/codex-automation-v2.ps1"
Write-Host "Changed: scripts/codex-automation-v2.test.ps1"
Write-Host "Changed: .github/workflows/ci.yml"

# Codex Master Prompt — Automation v2

Paste the following permanent instruction into Codex:

```text
Work directly inside D:\money\matchpulse_repo. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md. Run .\scripts\codex-automation-v2.ps1 -Mode Validate, execute only the repository-selected active phase and every validation in its pack, update only the permitted ACTIVE_PHASE.json completion metadata, then run .\scripts\codex-automation-v2.ps1 -Mode Prepare. Stop before Publish, preserve every unrelated local change, and never activate the next phase.
```

After reviewing the prepared commit, the human may separately instruct:

```text
Publish the already prepared MatchPulse phase commit by running .\scripts\codex-automation-v2.ps1 -Mode Publish. Do not change any file and do not use force push.
```

The active phase, exact pack, baseline, file allowlist, tests, gates, and completion transition are controlled by repository governance files, not by chat text.

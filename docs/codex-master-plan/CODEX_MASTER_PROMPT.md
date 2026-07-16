# Codex Master Prompt — Automation v2

Paste the following permanent instruction into Codex:

```text
Preserve D:\money\matchpulse_repo as read-only when dirty. Use a clean registered secondary worktree based on current origin/main. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md, validate the repository-selected active phase, execute its exact pack and validations, record completion, and continue with the next repository-recorded phase until a real human gate or blocker. Never use reset, stash, clean, rebase, force push, or edit the dirty primary worktree.
```

After reviewing the prepared commit, the human may separately instruct:

```text
Publish the already prepared MatchPulse phase commit by running .\scripts\codex-automation-v2.ps1 -Mode Publish. Do not change any file and do not use force push.
```

The active phase, exact pack, baseline, file allowlist, tests, gates, and completion transition are controlled by repository governance files, not by chat text.

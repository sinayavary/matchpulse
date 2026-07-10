# Codex Master Prompt

This is a permanent reusable prompt. It no longer names or embeds a phase-specific implementation.

Paste only the following instruction into Codex:

```text
Work directly inside D:\money\matchpulse_repo. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md, validate the repository-selected active phase, and execute it continuously until its declared phase gate or stop code. Do not ask for a phase-specific prompt and do not activate the next phase.
```

The active phase, exact pack, baseline, file scope, tests, and stop conditions are controlled by:

- `docs/codex-master-plan/ACTIVE_PHASE.json`
- `docs/codex-master-plan/EXECUTION_PROTOCOL.md`
- the pack referenced by `ACTIVE_PHASE.json`

For a new Codex session, paste the same permanent instruction. In an existing session, `Continue the repository-selected active MatchPulse phase.` is sufficient after the repository state changes.

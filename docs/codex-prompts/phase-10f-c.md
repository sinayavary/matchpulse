# Codex prompt — Phase 10F-C

Use only after an exact repository-controlled 10F-C pack has been reviewed and activated.

```text
Work directly inside D:\money\matchpulse_repo. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md. Run Automation v2 Validate and execute only the repository-selected Phase 10F-C pack. Apply the reviewed payload exactly; do not redesign retry, authentication, request validation, or stream behavior. Run every declared validation command, update only permitted completion metadata, then run Automation v2 Prepare. Stop with PHASE_COMPLETE_PREPARED before Publish. Do not activate 10H-A or another successor.
```

Review invariants:

- at most one guest-JWT refresh per operation
- retries only for `rate_limited`, `server_error`, `timeout`, and `network`
- maximum five transport attempts
- no reconnect after a stream has emitted data
- no secret/provider-body leakage
- no Prisma, route, worker, frontend, lockfile, migration, or real network change

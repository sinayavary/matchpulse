# Codex prompt — Phase 10H-B

Use only after the exact repository-controlled 10H-B pack has been reviewed and activated.

```text
Work directly inside D:\money\matchpulse_repo. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md. Run Automation v2 Validate and execute only the repository-selected Phase 10H-B pack. Apply the reviewed payload exactly; do not redesign the ensemble, market cap, terminal-state policy, confidence/risk calculation, explanation contract, IDs, coefficients, or safety boundaries. Run every declared validation command, update only permitted completion metadata, then run Automation v2 Prepare. Stop with PHASE_COMPLETE_PREPARED before Publish. Do not activate 10I or another successor.
```

Review invariants:

- output must pass `assertFinalPredictionSnapshotValid`
- market influence never exceeds the sanitized 10E-C/10H-A cap
- finished matches are terminal and assign zero market influence
- sparse data degrades confidence and adds explicit risk instead of inventing certainty
- snapshot IDs are deterministic from engine version, fixture/as-of, trigger, sequence, and feature hash
- no public route, DB, persistence, worker, frontend, migration, network, secret, or lockfile change
- no wagering recommendation or financial language

# MatchPulse Autonomous Execution Contract

> Review-only. `PROGRAM_PLAN.json` keeps program mode disabled until a separate governance change enables it.

## Execution loop

When enabled, execute one phase at a time (`max_parallel_phases: 1`): validate repository state, select the next eligible declared phase, verify its baseline and payload hashes, enforce its exact allowlist, implement, run all gates, stage exact paths, create one scoped commit, and record evidence.

Never rebase, reset, amend published history, force push, weaken tests, broaden an allowlist silently, activate an undeclared successor, or treat an unexecuted check as passed.

## Allowed local work

An active phase may perform reversible repository edits, offline tests, builds, Prisma generation, fixture-based adapter verification, Docker/local startup, and isolated local integration tests. It may create or apply a migration only when its manifest explicitly permits that action and the target is repository-owned local or ephemeral PostgreSQL.

## Separately authorized actions

Real external-service access, shared or remote database mutation, remote deployment, secret rotation, release publication, tag publication and any other remote mutation require separate explicit authorization. Exact host allowlists, credential variable names, timeouts, attempts and concurrency limits must be declared.

Missing TxLINE, Telegram, private-model or remote-deployment credentials block only live verification. Continue fixture, contract, local-fake and source work and record an honest not-run evidence code.

Solana/on-chain work remains deferred and is not required for completion.

## Required safeguards

- Protect secrets, provider data and private prediction policy.
- Keep public responses versioned and covered by forbidden-field tests.
- Preserve deterministic time/order, bounded retry/concurrency, idempotency and migration safety.
- Keep `ACTIVE_PHASE.json` and `PHASE_QUEUE.json` unchanged unless a separately approved transition explicitly allows them.
- Stop for workspace collision, invalid pack identity/hash, indispensable missing specification, failed required test, security finding, unsafe data action or unauthorized remote mutation.

## Evidence

Every phase report records baseline, phase/version, exact changed files, validation commands and results, migration/network activity, unavailable live checks, prepared/published commit when applicable, limitations, and confirmation that unrelated work and protected state files were preserved.

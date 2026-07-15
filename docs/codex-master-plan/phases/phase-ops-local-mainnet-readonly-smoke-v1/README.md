# Phase OPS-LOCAL-MAINNET-READONLY-SMOKE v1

## Status and authority

This is the exact repository-controlled implementation pack for `OPS-LOCAL-MAINNET-READONLY-SMOKE`.

- Pack version: `OPS-LOCAL-MAINNET-READONLY-SMOKE-v1`
- Exact baseline: `2d5c9958471e4a70d227b19ed78ec5424cc22662`
- Migration allowed: no
- TxLINE network access allowed: yes, only the GET-only mainnet smoke declared below
- Database mutation: no
- Wallet, subscription, activation, or token acquisition: no
- Odds or market access: no
- Deployment or other production operation: no

This pack is executable only while `ACTIVE_PHASE.json` selects this exact identity with `state=ready` and `human_approved=true`.

## Approved purpose

The owner approved one local, read-only TxLINE mainnet Level 12 smoke on the owner system. It may discover the current fixture snapshot, resolve fixture `18241006` (or the England/Argentina fallback), and obtain only that fixture's score snapshot and score updates.

Real `TXLINE_GUEST_JWT` and `TXLINE_API_TOKEN` values may be read only from the local `.env`. They must never enter Git, logs, reports, error output, raw payload output, or request diagnostics. This approval is not a general production-access exception.

## Clean execution clone

The owner must execute Automation v2 from `D:\money\matchpulse_mainnet_test` because the primary checkout contains unrelated local changes. The clean-clone exception is valid only when all of these checks pass immediately before Automation v2 Validate:

1. `origin` is the same `sinayavary/matchpulse` repository.
2. branch is exactly `main`.
3. `HEAD` equals the freshly fetched `origin/main` after this governance change is merged.
4. `git status --short` is empty.
5. `-RepoRoot D:\money\matchpulse_mainnet_test` is passed explicitly to Automation v2.

Automation v2 still runs only on `main`. Do not execute this phase from a side-branch worktree. Do not modify `D:\money\matchpulse_repo` to make it clean.

## Exact payload and application

The canonical patch in `payload/chunks/part-00.b64.part` creates only `scripts/mainnet-readonly-smoke.ps1`. The target is absent at the baseline and must not be hand-created or edited during phase execution.

Integrity identities:

- canonical-LF chunk SHA-256: `504c8226329e3603b0853a65c8cf42594352affbb9e850664ad1689dd9d7a79d`
- decoded gzip SHA-256: `ae8040586d9298194f54d75b6d5584921d17ebfe09f4464dc14c8f4f70e27d94`
- decoded canonical patch SHA-256: `2db5855c2e6044eb2fdb2128f7a17c77305399127a1c087b5ad592e8be514180`

Before application, verify the baseline is an ancestor of `HEAD`, the target is absent and clean, Automation v2 Validate passed, and all pack identities match `ACTIVE_PHASE.json`.

Use the canonical verification/application procedure already established by repository phase packs: canonicalize the single chunk to LF, verify its file and ordered-combined hash, remove whitespace from the base64 text, decode gzip, verify the gzip hash, decompress the patch, verify the patch hash, then run `git apply --check --whitespace=error-all` followed by `git apply --whitespace=error-all`. Never reorder, recompress, partially apply, or silently edit the payload.

## Script contract

The PowerShell 5.1-compatible script exposes:

- `-RepoRoot`
- `-FixtureId` (default `18241006`)
- `-ExpectedTeam1` (default `England`)
- `-ExpectedTeam2` (default `Argentina`)
- `-ValidateOnly`

It reads `.env` from `RepoRoot`, checks only that required secrets are configured, and requires mainnet network selection, service level `12`, the canonical HTTPS mainnet API base, a non-devnet HTTPS RPC, and `TXLINE_DATA_MODE=live`. `-ValidateOnly` stops after env/configuration and syntax/schema validation and performs no network call.

The live path may send only these GET requests with in-memory `Authorization: Bearer` and `X-Api-Token` headers:

1. `/fixtures/snapshot` without `competitionId`;
2. `/scores/snapshot/{fixtureId}`;
3. `/scores/updates/{fixtureId}`.

It may print only the approved fixture fields, score entry count, latest sequence/timestamp, phase/state, and home/away scores. It must never print raw payloads, headers, JWT, API token, exception bodies, or HTTP configuration.

The declared terminal mappings are:

- `401` -> `BLOCKED_BY_INVALID_OR_EXPIRED_GUEST_JWT`
- `403` -> `BLOCKED_BY_MAINNET_ENTITLEMENT`
- fixture absent -> `TARGET_FIXTURE_NOT_IN_CURRENT_SNAPSHOT`
- transport/other HTTP failure -> `TXLINE_NETWORK_FAILURE`
- fixture and score present -> `LOCAL_MAINNET_READONLY_SMOKE_COMPLETE`
- fixture present but score absent -> `LOCAL_MAINNET_FIXTURE_READY_SCORE_UNAVAILABLE`

## Exact allowed target

Only `scripts/mainnet-readonly-smoke.ps1` may be created. Do not modify TxLINE client code, frontend, API, worker, Prisma, migrations, dependencies, or other documentation during phase execution.

## Required validation

Run every manifest command in order. The second command is the approved and mandatory real network validation. It is not an odds smoke and it authorizes no write, wallet, activation, subscription, token, database, or deployment operation.

After every command passes, perform only the declared `ACTIVE_PHASE.json` completion transition, run Automation v2 Prepare, and stop before Publish. Keep `PHASE_QUEUE.json` unchanged and do not activate a successor.

# MATCHES-RAILWAY-PROJECT-BINDING-A v1

## Purpose

Repair the incomplete governance pack for explicit Railway project binding and the separately approved staging-environment creation gate. This pack authorizes governance validation and, only after the exact human gate is active, one explicit project-scoped attempt to create the environment named `staging`.

## Repository and phase identity

- phase: `MATCHES-RAILWAY-PROJECT-BINDING-A`
- pack: `MATCHES-RAILWAY-PROJECT-BINDING-A-v1`
- declared baseline: `b597c0720bec6539c8b22c33c6a6ecc43882e94e`
- Railway project ID: `e8540514-d2b9-4585-8d2a-a62fc3c87829`
- requested environment: `staging`

## Approved gate

The separately approved gate is `STAGING-ENVIRONMENT-CREATE-EXPLICIT`. It permits exactly one project-scoped Railway GraphQL create operation for the exact project ID above and exact environment name `staging`. The read-only project-binding diagnosis is a prerequisite in the pack, not an additional mutation authorization.

## Exact Railway scope

Allowed resource and operation:

- resource: `environment`
- operation: `create`
- project: `e8540514-d2b9-4585-8d2a-a62fc3c87829`
- environment name: `staging`
- transport: Railway GraphQL with explicit project ID
- maximum mutation attempts: `1`
- concurrency: `1`
- read timeout: `30` seconds

If `staging` already exists, do not create it again. Record the safe result only. No implicit CLI project binding is allowed.

## Preconditions

- recovery worktree is clean and based on current `origin/main`;
- active phase identity, pack identity, declared baseline, queue identity, project ID and environment name agree;
- the exact human approval and authorized gate are present;
- `RAILWAY_TOKEN` is available only through secure environment storage when the gate is executed;
- token values, authorization headers and all other secret values remain unprinted and unpersisted.

## Execution procedure

1. Run governance-only validation and confirm the pack hashes, JSON identity, allowlist and mutation boundary.
2. Perform the explicit project-binding diagnosis without mutation.
3. Confirm the exact project ID and whether `staging` already exists.
4. If `staging` does not exist and the authorized gate is active, make exactly one explicit project-scoped create attempt.
5. Do not retry, fall back to implicit binding, or perform another Railway operation.
6. Write only sanitized public-safe evidence to `docs/operations/matches-railway-topology-evidence.md` during phase execution.
7. Stop after the gate result; do not activate a successor gate or phase.

## Evidence rules

Evidence may include phase and pack identity, project ID, environment name, safe environment ID on success, existence result, timestamps, operation result, mutation attempt count, and invariant booleans. Evidence must not include tokens, authorization headers, database URLs, raw provider payloads, secret values, or fabricated observations.

## Forbidden operations

The following are forbidden in this phase: service creation or changes, variable changes, domain changes, database creation or access, deployment, migration, backfill, source-connection changes, cron changes, production HTTP, provider endpoint calls, secret rotation, retries, and any Railway operation other than the single authorized environment create.

## Validation requirements

- parse and validate all governance JSON;
- validate phase, pack, baseline, dependency, project and environment identity;
- validate the active authorized gate;
- verify the payload exists and all three pack hashes match canonical UTF-8/LF bytes;
- verify the exact allowlist and sanitized evidence rules;
- scan for secrets, tokens, Railway commands and forbidden operations;
- run `git diff --check`;
- verify exact changed paths.

No Railway or application test is part of governance repair. Automation v2 Validate is not used for this repair branch because the governance branch is intentionally ahead of `origin/main` until the repair commit is reviewed.

## Stop conditions

Stop with the repository's exact applicable code on missing payload/source, identity mismatch, hash mismatch, unauthorized path, missing human approval, ambiguous project binding, existing environment requiring no create, operation failure, secret exposure risk, or any forbidden mutation condition. Never guess or retry.

## Completion and handoff

Create exactly one local governance commit named `Repair Railway project-binding phase pack`. Stage only the six explicitly allowlisted governance paths. Do not push, merge, publish, run Automation Prepare/Publish, execute the Railway gate, or activate another phase. Final governance-repair status is `HUMAN_APPROVAL_REQUIRED` because publication of the repair commit requires review; the Railway gate remains separately governed.

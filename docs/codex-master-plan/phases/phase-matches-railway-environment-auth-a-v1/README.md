# MATCHES-RAILWAY-ENVIRONMENT-AUTH-A v1

## Purpose

Define the credential boundary needed to safely authorize explicit Railway environment creation after the predecessor could not establish project-wide identity. This governance pack itself authorizes no Railway access.

## Root cause and predecessor

`MATCHES-RAILWAY-PROJECT-BINDING-A` stopped with `STAGING_SCOPE_VIOLATION`: its project-scoped `RAILWAY_TOKEN` could not establish project-wide environment identity. No mutation occurred. This successor depends on that phase.

## Identity

- phase: `MATCHES-RAILWAY-ENVIRONMENT-AUTH-A`
- pack: `MATCHES-RAILWAY-ENVIRONMENT-AUTH-A-v1`
- baseline: `f491c805c659d860e41351bb231f606603743132`
- project: `e8540514-d2b9-4585-8d2a-a62fc3c87829`
- environment: `staging`

## Credential boundary, endpoint and transport

Only `RAILWAY_API_TOKEN` from the secure process environment is permitted. Its value and authorization header must never be printed, copied, persisted, hashed, truncated, logged, placed on a command line, or written to evidence. `RAILWAY_TOKEN` and Railway CLI are forbidden. Use only `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer <secure environment value>` and an explicit project ID; implicit project binding is forbidden.

## Gate sequence

1. `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-READONLY` requires a separate human instruction and permits one read-only project query. One read-only schema-correction request based on the official API contract is allowed only after `schema_contract_failed`; authentication and authorization failures are never retried.
2. `STAGING-ENVIRONMENT-CREATE-ACCOUNT-TOKEN` requires a later separate human instruction and only after the first gate succeeds. It permits one explicit project-scoped `staging` create attempt, with concurrency `1` and no retry. If `staging` already exists, mutation count is `0`.

## Read-only preflight scope

The first gate may obtain only project ID, project name, environment IDs and environment names to determine whether `staging` exists. Account profile, billing, variables, secrets, deployments, logs, domains, databases, mutations, schema-wide introspection, and unrelated inventory are forbidden.

## Create mutation scope

The future create gate is restricted to the exact project and exact name `staging`; it may be followed only by one read-only verification. No other operation is permitted.

## Evidence policy

Evidence is public-safe and may record identity, safe environment IDs, safe classifications, timestamps, counts and invariant booleans. It must never contain tokens, headers, database URLs, raw GraphQL responses or errors, provider payloads, private credentials, or fabricated observations.

## Forbidden operations

Services, variables, domains, databases, deployments, migrations, backfills, source connections, cron, production HTTP, Railway CLI, implicit binding, and any unauthorized mutation remain forbidden.

## Validation requirements

Validate JSON, predecessor/successor identity, queue semantics, required files, canonical UTF-8/LF SHA-256 hashes, exact changed paths, credential-name policy, secret-output prohibition, endpoint/header policy, forbidden-operation scan, and `git diff --check`. This governance change runs no Railway access and no Automation lifecycle command.

## Failure behavior

Reduce errors to `transport_error`, `authentication_failed`, `authorization_failed`, `schema_contract_failed`, `project_not_found`, `project_identity_mismatch`, or `ambiguous_result`; never print raw errors. Do not infer authorization from `state=ready` or `human_approved=true`.

## Completion and handoff

Create one local governance commit only. Do not push, merge, execute a phase, or run Automation Prepare/Publish. The successor remains `awaiting_human_approval`; its first separately approvable gate is `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-READONLY`.

# MATCHES-RAILWAY-TRANSPORT-DIAGNOSTIC-A v1

## Governance purpose

Classify the predecessor Railway transport failure with one separately human-activated unauthenticated endpoint probe, then—only after a successful transport result and separate human approval—govern one read-only account-token project preflight retry. Governance publication performs no Railway access.

## Predecessor accounting

`MATCHES-RAILWAY-ENVIRONMENT-AUTH-A` / `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-READONLY` ended with `ACCOUNT_TOKEN_TRANSPORT_FAILED`: `primary_read_requests=1`, `schema_correction_requests=0`, `RAILWAY_API_TOKEN_PRESENT=true`, `authenticated_request_attempts=1`, `provider_received_authenticated_request=unknown`, `project_identity_observed=false`, `environment_identity_observed=false`, `mutation_attempts=0`, `secret_exposed=false`.

The transport failure does not prove whether the provider received the authenticated request. It does not authorize a retry.

## Two gates

1. `RAILWAY-ENDPOINT-TRANSPORT-DIAGNOSTIC-READONLY` requires separate human activation. It permits at most one DNS lookup, one TCP 443 check and one HTTPS reachability request to `https://backboard.railway.com/graphql/v2`, with zero authenticated request attempts, no token, no Authorization header, no GraphQL/account/project/environment data and no retry. It records one safe classification only.
2. `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-RETRY-READONLY` requires separate human approval, `HTTP_ENDPOINT_REACHABLE` and `RAILWAY_API_TOKEN`. It permits one primary read and, only after `schema_contract_failed`, one schema-correction read; only project/environment IDs and names may be returned.

No automatic retry, mutation, staging creation, service/variable/domain/database/deployment/migration/backfill operation, production HTTP or Railway CLI is allowed.

## Execution allowlist

The future phase execution `allowed_target_files` contains exactly one path: the sanitized evidence payload. `AGENTS.md`, `EXECUTION_PROTOCOL.md`, `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, this README, the manifest and the hash contract are governance-scope paths for this publication and are not execution targets. `ACTIVE_PHASE.json` remains changeable only through the global completion-metadata exception.

The successor begins `state=awaiting_human_approval`, `human_approved=false`, with no `authorized_gate` object. Before activation, evidence must use `next_authorized_gate=NONE` and `next_approvable_gate=RAILWAY-ENDPOINT-TRANSPORT-DIAGNOSTIC-READONLY`.

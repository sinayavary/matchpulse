# MATCHES-RAILWAY-TRANSPORT-DIAGNOSTIC-A v1

## Purpose

Classify the predecessor Railway transport failure with one unauthenticated endpoint probe, then—only after a successful transport result and separate human approval—govern one read-only account-token project preflight retry. This pack is governance only and performs no Railway access.

## Predecessor and observed boundary

- predecessor phase: `MATCHES-RAILWAY-ENVIRONMENT-AUTH-A`
- predecessor gate: `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-READONLY`
- predecessor result: `ACCOUNT_TOKEN_TRANSPORT_FAILED`
- primary read requests: `1`
- schema correction requests: `0`
- authenticated requests: `0` observed in the failed transport run
- mutations: `0`
- project/environment identity observed: `false`
- secret exposed: `false`

The transport failure is not yet assigned to a provider-side root cause. Gate 1 assigns exactly one safe classification from the manifest allowlist.

## Gate sequence

1. `RAILWAY-ENDPOINT-TRANSPORT-DIAGNOSTIC-READONLY` is the first gate. It requires no token or `Authorization` header and may perform at most one DNS lookup, one TCP 443 check, and one HTTPS reachability request to `https://backboard.railway.com/graphql/v2`. It requests no account, project, environment, or GraphQL data.
2. `ACCOUNT-TOKEN-PROJECT-PREFLIGHT-RETRY-READONLY` is separately approvable and is executable only when Gate 1 classifies the endpoint as `HTTP_ENDPOINT_REACHABLE`, a separate human approval is recorded, and `RAILWAY_API_TOKEN` is present. It permits one primary read and, only after `schema_contract_failed`, one schema-correction read.

No automatic retry is allowed. A failed or ambiguous transport classification stops the phase.

## Safe transport classifications

`DNS_RESOLUTION_FAILED`, `TCP_443_UNREACHABLE`, `TLS_HANDSHAKE_FAILED`, `HTTP_ENDPOINT_REACHABLE`, `HTTP_TRANSPORT_FAILED`, `LOCAL_PROXY_INTERFERENCE_SUSPECTED`, `AMBIGUOUS_TRANSPORT_RESULT`.

Only explicit local evidence may produce `LOCAL_PROXY_INTERFERENCE_SUSPECTED`; proxy names and values are never recorded. Raw bodies, headers, IPs, certificate details, and raw errors are never recorded.

## Retry scope and evidence

The retry may read only `project_id`, `project_name`, `environment_ids`, and `environment_names`. It performs no mutation, environment creation, service/variable/database/deployment/migration/backfill operation, or production HTTP access. Token values, authorization headers, raw GraphQL responses, and raw errors are prohibited from evidence.

The evidence payload is an allowlisted public-safe template. It records counts, booleans, safe classifications, predecessor status, and the next authorized gate; it does not claim that an unexecuted gate succeeded.

## Completion and handoff

The successor starts with `state=awaiting_human_approval` and `human_approved=false`. Governance publication does not approve or execute either gate. Commit only the exact allowlisted governance paths, push the branch, and do not create a PR, merge, or invoke Automation lifecycle commands.

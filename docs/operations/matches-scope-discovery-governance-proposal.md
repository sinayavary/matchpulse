# Governance Proposal: Resolve `MISSING_SOURCE` for Matches Scope

Status: proposal only. This document does not activate a gate and authorizes no Railway operation.

## Decision context

The `SCOPE-DISCOVERY-READONLY` gate was re-run against project `vibrant-serenity` using the approved project metadata scope. The result remains `MISSING_SOURCE`: production scope is partially provable, while staging and the three independent worker bindings are not.

No service, environment, variable, deployment, migration, database, domain, or source configuration was created or changed.

## Verified production inventory

Project ID: `e8540514-d2b9-4585-8d2a-a62fc3c87829`
Environment: `production` (`704417a2-a89e-45ee-8900-a738149d675e`)

| Service ID | Service name | Verified production role | Public origin |
| --- | --- | --- | --- |
| `1fd625ca-6da0-4bfd-a5ad-08230ec6a4be` | `mathpluse-api` | API | `https://mathpluse-api-production.up.railway.app` |
| `6c419813-4f23-49b7-b613-8d0cbf21e8a8` | `mathpluse-api Copy` | Unbound; role not proven | none observed |
| `cec81dbb-80c4-4c5d-a332-eac04a03c7a5` | `matchpulse-web` | Web | `https://matchpulse-web-production.up.railway.app` |
| `d140ac5b-ea2a-40ee-bbe9-c0c64a1ae4bc` | `matchpulse` | Unbound; role not proven | none observed |

The inventory is metadata evidence only. Deployment state, migration state, health, worker heartbeats, variables, and database state are outside this proposal.

## Sources checked and why they were insufficient

| Required source | Read-only source checked | Exact reason it did not prove scope |
| --- | --- | --- |
| Staging environment | Project environment metadata | Only `production` was returned; no staging environment ID or name was present. |
| Staging API service | Environment service-instance metadata | No staging environment existed in the returned metadata, so no staging API binding could be associated safely. |
| Staging Web service | Environment service-instance metadata and domains | No staging environment or staging domain was returned; assigning a production service would be an unsafe guess. |
| Staging ingestion worker | Project services and production service instances | No staging binding or role label proved an ingestion worker. |
| Staging agent worker | Project services and production service instances | No staging binding or role label proved an agent worker. |
| Staging evaluation worker | Project services and production service instances | No staging binding or role label proved an evaluation worker. |
| Production ingestion/agent/evaluation workers | Four project services plus production service instances | `mathpluse-api Copy` and `matchpulse` had no trustworthy role binding; reusing either for a worker would be an unsupported inference. |
| Public staging origins | Service-domain metadata | No staging environment or staging API/Web domains were returned. |

## Safe blocker-resolution options

1. **Evidence-only path (preferred):** provide independently verified, existing IDs for staging and each required service role, plus staging API/Web origins. A later read-only remediation gate can verify those exact bindings without changing Railway.
2. **Governance-approved topology creation:** if the resources truly do not exist, approve a separate, narrowly scoped topology gate for creation of only the named staging environment and missing services. This proposal does not authorize that work; variables, domains, deployments, migrations, and database actions must remain separate gates.
3. **Role-binding clarification:** provide authoritative service-role mapping for existing unbound services, together with proof that the mapping is intended for the target environment. A name similarity or deployment status alone is not sufficient.
4. **Stop condition:** if exact IDs, role mapping, or ownership cannot be supplied, keep the rollout blocked at `MISSING_SOURCE`.

## Exact human inputs required

Before any follow-up gate is activated, the approver must provide, in writing:

- the exact next gate ID and explicit read-only or mutation scope;
- confirmation of project ID `e8540514-d2b9-4585-8d2a-a62fc3c87829` and target environment name/ID;
- staging environment ID, or explicit approval for a separately named environment-creation gate;
- exact service ID for each role: API, Web, ingestion worker, agent worker, and evaluation worker, for both staging and production where applicable;
- authoritative role mapping for any existing unbound service;
- staging API origin and staging Web origin, or explicit approval for a separately named domain-creation gate;
- whether topology creation is allowed; if yes, the exact resource, operation, attempt limit, and transport;
- confirmation that variables, secret reads, database access, migration, deployment, source connection, cron, and public exposure remain forbidden unless separately named and approved;
- confirmation that the only local credential name permitted for Railway metadata remains `RAILWAY_TOKEN`, without revealing or copying its value.

## Proposed next gate

`STAGING-SCOPE-REMEDIATION-READONLY`

Purpose: verify the exact supplied staging environment/service IDs, role bindings, and API/Web origins against Railway metadata. The gate must be read-only, single-project, concurrency one, and must stop with `MISSING_SOURCE` if any required binding is absent or ambiguous.

This gate is proposed only. It is not activated, does not transition the phase, and does not authorize creation of an environment or service. If the evidence-only path fails, a separate human decision is required for a narrowly scoped topology-creation gate before any staging preflight can be considered.

## Explicit non-authorizations

This proposal authorizes no creation or mutation of any kind. In particular, it does not authorize creating or modifying a service, environment, variable, domain, deployment, migration, database, source connection, cron, or secret. No next phase or next gate is activated by this document.

# MatchPulse Phase Pack Authoring Standard

Every phase pack is reviewable, deterministic and limited to one technical outcome.

## Required files

- `README.md`: objective, boundaries, dependencies, invariants, implementation instructions, tests, rollback/degraded behavior and stop conditions.
- `manifest.json`: schema/phase/version/baseline identity, dependencies, risk, exact sorted allowed files, forbidden patterns, required commands/outcomes, migration/network/public-contract/security/git policy and completion behavior.
- `EXPECTED_SHA256.json`: SHA-256 for every exact payload file using repository-canonical LF bytes.
- `payload/` for reviewed exact changes, or atomic acceptance criteria for an implementation-spec pack.

## Safety defaults

Network, migration creation/application, remote mutation and publishing default to false. A migration exception must name isolated local or ephemeral PostgreSQL and include validation plus rollback/forward-fix evidence. External access must declare exact hosts, environments, credential variable names, timeouts, attempts and concurrency limits; secret values never appear.

Public-contract phases declare the API version and forbidden internal fields. Every pack requires secret and public-leakage checks when relevant. `ACTIVE_PHASE.json` and `PHASE_QUEUE.json` are excluded unless a separate exact governance transition permits them.

## Acceptance and validation

Criteria are atomic and map one-to-one to tests, typecheck, build, scan, diff or local runtime probes. Commands declare working directory, expected exit code, network expectation, database-mutation expectation and artifacts. They may not hide failure.

Tests cover happy path, boundaries, missing dependencies, deterministic repetition, immutability, ordering/duplicates, retry/concurrency/cancellation, safe errors, forbidden public fields and migration/no-migration evidence as applicable.

## Review checklist

- Baseline is the declared current main ancestor and payload hashes verify.
- Dependencies and gates exist; 10H-A remains review-only until separately activated.
- Files are exact and minimal; payload introduces no secret, provider dump, generated dependency tree or private policy.
- Migration and network permissions are deny-by-default and technically bounded.
- Required commands cover changed surfaces and repository-wide gates.
- Git uses exact-path staging, one scoped commit, no history rewrite and no force push.
- Completion evidence records files, commands/results, migrations, network activity, limitations and immutable commit references.

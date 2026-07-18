# MATCHES-RAILWAY-TOPOLOGY-RETRY-A v1

Diagnose the failed `staging` create attempt, then permit one new attempt only after a distinct human gate. Project: `e8540514-d2b9-4585-8d2a-a62fc3c87829`; environment: `staging`; local credential: `RAILWAY_TOKEN` only.

1. `STAGING-ENVIRONMENT-DIAGNOSE-READONLY`: inspect Railway CLI help/version and project environment metadata; no mutation.
2. `STAGING-ENVIRONMENT-CREATE-RETRY`: only after diagnosis and a separate approval, make exactly one create attempt for absent `staging`; no retry.

No service, variable, domain, database, deployment, migration or source-connection operation is allowed. Evidence may only be written to `docs/operations/matches-railway-topology-evidence.md`; never include secrets or raw payloads.

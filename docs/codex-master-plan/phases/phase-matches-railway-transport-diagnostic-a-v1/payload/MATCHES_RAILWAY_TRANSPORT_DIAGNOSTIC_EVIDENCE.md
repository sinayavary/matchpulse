# Railway transport diagnostic evidence

This file is a sanitized, allowlisted evidence template. Governance publication performed no Railway requests.

```text
predecessor_phase=MATCHES-RAILWAY-ENVIRONMENT-AUTH-A
predecessor_gate=ACCOUNT-TOKEN-PROJECT-PREFLIGHT-READONLY
predecessor_status=ACCOUNT_TOKEN_TRANSPORT_FAILED
transport_gate_result=NOT_EXECUTED
transport_classification=UNCLASSIFIED
dns_lookup_count=0
tcp_443_check_count=0
tls_https_request_count=0
primary_read_requests=0
schema_correction_requests=0
authenticated_requests=0
RAILWAY_API_TOKEN_PRESENT=BOOLEAN_NOT_OBSERVED
mutation_attempts=0
database_accessed=false
migration_applied=false
deployment_performed=false
backfill_performed=false
secret_exposed=false
next_authorized_gate=RAILWAY-ENDPOINT-TRANSPORT-DIAGNOSTIC-READONLY
separate_human_approval=false
```

Allowed future `transport_classification` values are the seven safe classifications in `manifest.json`. Never add token values, authorization headers, raw responses/errors, IPs, certificate details, proxy names/values, or provider payloads.

# Matches Catalog Troubleshooting

| Symptom | Inspect | Safe interpretation |
| --- | --- | --- |
| Upcoming empty | lifecycle reason and failed discovery days | no verified scheduled rows were found |
| partial data | item availability and `data_status` | a specific domain is missing or stale |
| repeated cards | cursor range/version/snapshot | discard invalid cursor and restart |
| duplicate source rows | reconciliation dry-run groups | source rows remain preserved |
| discovery gap | health coverage ledger | retry through the worker, never manual SQL |
| stale score/odds/events | latest timestamps and error status | stale is not the same as unavailable |
| `product_ready=false` | component reason codes | API liveness can remain true while dependencies are degraded |
| worker lock unavailable | owner and lease expiry in safe health raw | wait for expiry; do not clear locks manually |
| production Web startup fails | server/public API URL variables | configure a valid HTTP(S) origin; localhost is development-only |
| browser CORS rejection | `CORS_ORIGIN` allowlist | add the exact trusted origin and redeploy through the normal gate |

Never expose provider payloads, credentials, database URLs, or internal model details while
diagnosing a public catalog issue.

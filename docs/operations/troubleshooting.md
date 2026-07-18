# Matches Catalog Troubleshooting

| Symptom | Inspect | Safe interpretation |
| --- | --- | --- |
| Upcoming empty | lifecycle reason and failed discovery days | no verified scheduled rows were found |
| partial data | item availability and `data_status` | a specific domain is missing or stale |
| repeated cards | cursor range/version/snapshot | discard invalid cursor and restart |
| duplicate source rows | reconciliation dry-run groups | source rows remain preserved |
| discovery gap | health coverage ledger | retry through the worker, never manual SQL |
| stale score/odds/events | latest timestamps and error status | stale is not the same as unavailable |

Never expose provider payloads, credentials, database URLs, or internal model details while
diagnosing a public catalog issue.

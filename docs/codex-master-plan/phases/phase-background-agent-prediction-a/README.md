# BACKGROUND-AGENT-PREDICTION-A v1

Make Data, Intelligence, and Trainer failure domains explicit. After each persisted data cycle, automatically build canonical state, run public-safe Agent, build an as-of feature snapshot, run versioned Prediction, and persist immutable deduplicated results without a browser or user request.

Required: leases, heartbeat, idempotency, bounded retry/backoff, per-fixture isolation, graceful shutdown, restart recovery, trigger taxonomy, input-hash deduplication, safe errors, and health reporting. No model internals or betting output may cross the public boundary.

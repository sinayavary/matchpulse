# Phase 10G-A/B — Streaming ingestion and backfill

This pack implements the deterministic, provider-agnostic ingestion boundary for TxLINE streams and historical replay planning.

- resumable score/odds stream supervision with bounded jittered reconnects;
- explicit checkpoint lifecycle, heartbeat timeout, and SSE-id deduplication;
- deterministic five-minute UTC backfill enumeration;
- bounded-concurrency backfill execution.

No network, database, migration, or production operation is part of this pack.

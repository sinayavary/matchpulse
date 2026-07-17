# AUTO-DATA-RUNTIME-PRODUCTION-RECOVERY-A

Recover the production always-on runtime without schema, migration, seed, or fabricated-data changes.

This phase owns safe Worker diagnostics, PostgreSQL availability/lock lifecycle, HealthStatus heartbeat state, dynamic UTC discovery windows, adaptive wake scheduling, persisted-only public health metadata, and production env references. It must not print secrets or raw provider payloads.

Required production checks use only the scoped Railway API and Worker services. The Worker has one replica, no public domain, no cron, and no seed/migration startup command.

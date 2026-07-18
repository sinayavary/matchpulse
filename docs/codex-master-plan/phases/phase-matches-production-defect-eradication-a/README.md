# MATCHES-PRODUCTION-DEFECT-ERADICATION-A

This successor phase audits and repairs production-visible Matches defects from the official baseline `7d99b1d59f1c5811943553cb4226cf05e62fac7a`.

Scope is end-to-end: TxLINE discovery, persistence, lifecycle classification, canonical identity, public API range/cursor behavior, Web grouping, deployment-version evidence, and read-only production verification. No production write, migration, seed, deployment, or fabricated fixture is allowed by this pack.

The phase must preserve UTC instants in the API and use browser-local calendar days only for Web grouping. Public responses may expose safe diagnostics but never raw provider payloads, tokens, or internal lineage.

Completion requires evidence for duplicate suppression across bucket boundaries, tomorrow coverage and missing-day causes, stable pagination, lifecycle exclusion, timezone boundaries, and deployed version verification. If production credentials or deployment metadata are unavailable, record the limitation and keep the phase out of Production Accepted.

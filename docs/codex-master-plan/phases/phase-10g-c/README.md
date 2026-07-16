# Phase 10G-C — Canonical timeline persistence

Adds local PostgreSQL persistence for TxLINE stream checkpoints and canonical timeline events. Events are idempotent on `(stream_kind, fixture_id, event_id)` and checkpoint writes are idempotent on `(stream_kind, fixture_id)` inside one transaction.

Evidence: migration `20260716205528_phase_10g_c_timeline` applied to embedded PostgreSQL 16.14; both tables queried successfully; persistence foundation tests 3/3, API regression, typecheck, build, and diff-check pass. No remote database was used.

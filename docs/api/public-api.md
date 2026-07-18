# Public Matches API

`GET /api/public/matches` supports `live`, `starting_soon`, `upcoming`,
`recently_finished`, `interrupted`, and `all`; legacy `past` remains broader history.
Filtering, batch enrichment, canonical deduplication, sorting, and cursor seeking happen
before the response page.

The cursor is opaque and versioned. It binds range, direction, snapshot time, primary and
secondary sort values, and the fixture tie-breaker. Malformed, cross-range, or wrong-version
cursors are rejected.

Each item reports lifecycle and evidence-derived score, odds, and event availability. The
states are `available`, `not_expected_yet`, `not_attempted`, `upstream_no_data`, `stale`,
`upstream_error`, and `unsupported`. Raw payloads and internal lineage never appear.

`recently_finished` is limited to the latest 48 hours; `past` retains broader history.

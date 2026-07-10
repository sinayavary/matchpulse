# Phase 10E-A — Odds Market Normalization

## Scope
This document describes the normalization layer for stored Odds observations, implemented as the foundation for the final Odds Intelligence engine.

## Input Type
The `StoredOddsObservation` type defines the safe internal input structure. It explicitly excludes raw or provider payload fields.

## Parsed Market Identity
The `parseStoredOddsMarketId` function deterministically parses encoded `marketId` values (e.g., `bookmaker:Test|type:1|period:0|parameters:2.5`). It extracts the provider key, odds type, period, and parameters.

## Provider Identity Policy
Provider identity is derived solely from the `bookmaker` segment. Missing providers map to `null`.

## Stable Consolidated Provider Policy
`TXLineStablePriceDemargined` is treated as a single identifiable source, not as broad provider consensus.

## Market Aliases
The `normalizeOddsMarketType` function maps market names and encoded types to `NormalizedOddsMarketType`. Supported aliases include `1x2`, `match result`, `double chance`, `total goals`, `btts`, `asian handicap`, `next goal`, and `correct score`.

## Selection Aliases
The `normalizeOddsSelection` function maps selection names to `NormalizedOddsSelectionType`. Supported aliases include `1`, `home`, `x`, `draw`, `2`, `away`, `yes`, `no`, `over`, `under`, and `none`.

## Line Parsing
The `parseOddsMarketLine` function extracts numeric lines from parameters, selection names, or market names. It prioritizes explicit parameters and avoids parsing correct-score values or team numbers.

## Canonical Market Key
The `buildCanonicalOddsMarketKey` function generates a deterministic key based on market type, period, line, and parameters. It excludes provider identity and raw market IDs.

## Unknown-Market Behavior
Unknown markets are safely preserved and mapped to `unknown`. They do not cause crashes.

## Security Boundaries

`StoredOddsObservation` intentionally contains no raw provider payload, authorization data, credentials, secrets, tokens, or model internals.

The normalized output is constructed explicitly from approved fields and therefore does not copy unknown input properties into the result.

Runtime rejection of arbitrary extra JavaScript object properties is outside the scope of this layer. The security guarantee is that such properties are neither selected by the database service nor propagated into normalized output.

## Deferred Phase 10E-B Work
The full intelligence engine, probability calculations, and persistence logic are deferred to Phase 10E-B.

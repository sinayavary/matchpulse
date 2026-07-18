# Phase FREE-ACCESS-SECURITY-A

## Free wallet access and secure free developer API

Pack version: `FREE-ACCESS-SECURITY-A-v1`

Baseline: `5102320e13d0a25ea2a5b346043acc500ac92e65`

This phase implements the approved architecture in:

`docs/security/free-access-wallet-and-api-architecture.md`

## Product decisions

- Every feature remains free.
- Website users register and sign in by an off-chain Solana wallet signature only.
- Website login never requests a blockchain transaction, fee, wallet balance, token holding, NFT, or asset permission.
- API consumers first wallet-sign in, create a developer application, receive a one-time client secret, and exchange it for a short-lived opaque access token.
- All external scopes are read-only.
- Fair-use rate limits and quotas are mandatory and equal for all developer applications.
- There are no paid plans, billing, subscriptions, or paywalls.
- Existing internal service identities remain separate and cannot be replaced by external credentials.

## Authority

The exact implementation contract is:

`payload/FREE_ACCESS_SECURITY_IMPLEMENTATION.md`

Codex must not invent another wallet message, credential format, token lifetime, schema, scope, quota, endpoint, cookie, dependency, or security threshold.

## Human gates

Activation requires explicit approval for:

1. wallet-based website identity;
2. breaking the previously anonymous public-data access contract;
3. Prisma schema and development migration creation;
4. dependency and lockfile changes.

This pack does not authorize:

- production migration;
- deployment;
- Railway/CDN/WAF configuration;
- production network access;
- acquisition or printing of secrets;
- real-wallet testing;
- changes to TxLINE subscription or credentials.

## Definition of Done

- architecture and payload implemented exactly;
- all focused, API, Web, workspace, Prisma, build, and diff checks pass;
- no external credential reaches internal routes;
- secrets and wallet signature material are absent from logs and public responses;
- migration exists but is not applied to production;
- no network or deployment occurs;
- only allowlisted files plus the exact completion transition are changed;
- Automation v2 Prepare succeeds;
- final status is `PHASE_COMPLETE_PREPARED`.

Then stop.

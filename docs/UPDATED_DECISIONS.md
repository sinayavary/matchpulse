# Updated Project Decisions

This file records owner decisions made after the first documentation draft.

## Confirmed

1. Use one monorepo for frontend, backend, worker, docs, and mock data.
2. Current names are temporary; final naming will be changed near the end.
3. Telegram bot/alerts are required in MVP.
4. Leaderboard is not required because the product has no prizes or reward competition.
5. Development should start on devnet to avoid real costs and test activation safely.
6. The product must clearly show the blend of Solana/Web3 infrastructure and modern sports intelligence.
7. Normal users should not need a wallet. Wallet/keypair is only for TxLINE subscription activation and backend credentials.
8. Product language remains English.
9. The product shows odds and market insights but must not provide direct betting execution or guaranteed betting recommendations.
10. Neon.tech is the planned managed Postgres provider.
11. Upstash Redis is optional and only used if a concrete need appears for cache, queue, rate limiting, worker health, or latest match state cache.
12. Redis is not required for Phase 9A or Phase 9B, and Neon/Prisma work starts in Phase 10.
13. Phase 9B stays focused on the minimal normalizer first.

## Wallet Clarification

For TxLINE activation, “wallet” means a Solana wallet or keypair that can sign:

- the on-chain subscription transaction
- the activation message used to receive the API token

For development, this should be a dedicated devnet Solana wallet/keypair.

The consumer-facing app does not require users to connect wallets.

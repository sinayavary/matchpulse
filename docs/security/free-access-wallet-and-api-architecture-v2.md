# Free-access wallet, API, and documentation architecture

This v2 contract is free for all users. Website identity uses an off-chain Solana wallet signature only; the wallet is never a payment or asset authorization mechanism. Transactions, transfers, approvals, fees, balances, token holding, NFTs, deposits, payouts, billing, subscriptions, plans, and paywalls are forbidden.

Developers create a free application, receive a client ID and one-time client secret, and use a client-credentials exchange for a short-lived opaque access token. Secrets are stored only as secure verifiers, no refresh token is used, external scopes are read-only, quotas are fair-use limited, and internal routes reject external credentials. Private keys and seed phrases are never requested or stored.

The Developer Documentation Portal is in scope at `/developers` and `/developers/docs`: Quick Start, wallet sign-in, application creation, one-time secret handling, token exchange, scopes, rate limits/quotas, pagination, errors, rotation/revocation, OpenAPI reference, curl/PowerShell/TypeScript/Python examples, dashboard, versioning, changelog, deprecation, security guidance, and safe authenticated Try It. It must not expose internal routes, secrets, raw provider data, or private formulas.

# Free access operations runbook

The API is free and read-only. Wallet signatures are off-chain identity only; no transaction, fee, token, NFT, balance, payment, billing, subscription, or paywall flow exists.

Rotate signing/configuration secrets by disabling affected applications and revoking credentials/tokens. Audit events must be recursively redacted. On incident, disable the application, preserve sanitized request IDs, and revoke exposed credentials. Rollback is a reviewed revert plus revocation; migration apply, database connection, deployment, and production acceptance are outside this phase.
